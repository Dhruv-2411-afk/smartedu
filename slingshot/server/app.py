import json
import os
import time
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Resolve the project's .env rather than relying on the PowerShell working directory.
load_dotenv(Path(__file__).resolve().parent.parent / '.env')
app = Flask(__name__)

CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    supports_credentials=True
)
OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
MODEL = 'qwen/qwen3-30b-a3b'
RESOURCE_CACHE = {}
GITHUB_CACHE = {}


@app.get('/api/health')
def health_check():
    return jsonify(
        service='slingshot-assessment-api',
        version='readiness-v2',
        openrouterConfigured=bool(os.getenv('OPENROUTER_API_KEY')),
    )


def github_request(path):
    headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Slingshot-CareerOS',
    }
    token = os.getenv('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f'Bearer {token}'
    response = requests.get(f'https://api.github.com{path}', headers=headers, timeout=20)
    if response.status_code == 404:
        raise ValueError('GitHub profile was not found. Check the GitHub URL in Update Resume.')
    if response.status_code in (403, 429):
        reset_at = response.headers.get('X-RateLimit-Reset')
        suffix = f' Try again after {time.strftime("%H:%M", time.localtime(int(reset_at)))}.' if reset_at else ''
        raise PermissionError(f'GitHub rate limit reached.{suffix} Add a server-side GITHUB_TOKEN to increase the limit.')
    response.raise_for_status()
    return response.json()


@app.get('/api/github/<username>')
def github_analytics(username):
    if not re.fullmatch(r'[A-Za-z0-9-]{1,39}', username):
        return jsonify(error='Enter a valid GitHub username or profile URL.'), 400
    cache_key = username.lower()
    cached = GITHUB_CACHE.get(cache_key)
    if cached and time.time() - cached['created_at'] < 600:
        return jsonify(cached['data'])
    try:
        account, repos, events = (
            github_request(f'/users/{username}'),
            github_request(f'/users/{username}/repos?type=owner&sort=updated&direction=desc&per_page=100'),
            github_request(f'/users/{username}/events/public?per_page=100'),
        )
        repos = repos if isinstance(repos, list) else []
        events = events if isinstance(events, list) else []
        scanned_repos = repos[:20]
        def count_branches(repo):
            branches = github_request(f'/repos/{account["login"]}/{repo["name"]}/branches?per_page=100')
            return len(branches) if isinstance(branches, list) else 0
        with ThreadPoolExecutor(max_workers=6) as executor:
            branch_counts = list(executor.map(count_branches, scanned_repos)) if scanned_repos else []
        recent_commits = sum(len(event.get('payload', {}).get('commits', [])) for event in events if event.get('type') == 'PushEvent')
        open_source_activity = sum(
            1 for event in events
            if not event.get('repo', {}).get('name', '').lower().startswith(f'{account["login"].lower()}/')
            and event.get('type') in {'PushEvent', 'PullRequestEvent', 'IssuesEvent', 'IssueCommentEvent', 'PullRequestReviewEvent', 'CreateEvent'}
        )
        data = {
            'account': {'login': account['login'], 'name': account.get('name') or account['login'], 'avatar': account.get('avatar_url'), 'profileUrl': account.get('html_url'), 'bio': account.get('bio'), 'followers': account.get('followers', 0), 'following': account.get('following', 0), 'publicRepos': account.get('public_repos', len(repos))},
            'stats': {'repositories': len(repos), 'branches': sum(branch_counts), 'scannedRepositories': len(scanned_repos), 'recentCommits': recent_commits, 'openSourceActivity': open_source_activity},
            'repositories': [{'name': repo['name'], 'description': repo.get('description') or 'No description provided.', 'url': repo['html_url'], 'language': repo.get('language') or '—', 'stars': repo.get('stargazers_count', 0), 'forks': repo.get('forks_count', 0), 'updatedAt': repo.get('updated_at')} for repo in repos[:8]],
        }
        GITHUB_CACHE[cache_key] = {'created_at': time.time(), 'data': data}
        return jsonify(data)
    except PermissionError as error:
        return jsonify(error=str(error)), 429
    except ValueError as error:
        return jsonify(error=str(error)), 404
    except requests.RequestException:
        return jsonify(error='GitHub could not load this public profile right now.'), 502


def generate_questions(profile, skill, question_count=5):
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        raise ValueError('OPENROUTER_API_KEY is not configured on the assessment server.')

    prompt = f'''You are a technical interviewer creating an initial skill assessment
for a student career and placement platform.

The student's structured profile is:
{json.dumps(profile, indent=2)}

Create exactly {question_count} multiple-choice questions for the claimed skill: {skill}.
Only assess concepts genuinely related to {skill}; do not test resume facts, CGPA, employers,
or technologies absent from the profile. Use a progression from medium to hard and vary topics.
Every question must have exactly four plausible choices and exactly one correct answer.

Return only valid JSON in this exact shape:
{{"questions":[{{"id":1,"skill":"{skill}","topic":"specific concept","difficulty":"medium","question":"question text","options":{{"A":"...","B":"...","C":"...","D":"..."}},"correct_answer":"A","explanation":"brief explanation"}}]}}
'''

    response = requests.post(
        OPENROUTER_URL,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': MODEL,
            'messages': [
                {'role': 'system', 'content': 'You create objective technical MCQ assessments. Return valid JSON only.'},
                {'role': 'user', 'content': prompt},
            ],
            'temperature': 0.7,
            'response_format': {'type': 'json_object'},
        },
        timeout=180,
    )
    response.raise_for_status()
    content = response.json()['choices'][0]['message']['content'].replace('```json', '').replace('```', '').strip()
    questions = json.loads(content).get('questions', [])
    if len(questions) != question_count:
        raise ValueError(f'Expected {question_count} questions, received {len(questions)}.')
    return questions


def openrouter_json(system_prompt, user_prompt, temperature=0.3):
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        raise ValueError('OPENROUTER_API_KEY is not configured on the assessment server.')
    response = requests.post(
        OPENROUTER_URL,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': MODEL,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
            'temperature': temperature,
            'response_format': {'type': 'json_object'},
        },
        timeout=180,
    )
    response.raise_for_status()
    try:
        content = response.json()['choices'][0]['message']['content']
        if not isinstance(content, str) or not content.strip():
            raise ValueError('Model returned an empty response.')
        return json.loads(content.replace('```json', '').replace('```', '').strip())
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise ValueError(f'Model returned invalid JSON: {error}') from error


@app.post('/api/tars/chat')
def tars_chat():
    body = request.get_json(silent=True) or {}
    message = body.get('message')
    context = body.get('context', {})
    history = body.get('history', [])
    if not isinstance(message, str) or not message.strip():
        return jsonify(error='Ask TARS a question first.'), 400
    if not isinstance(context, dict):
        context = {}
    if not isinstance(history, list):
        history = []
    safe_history = [
        {'role': item.get('role'), 'content': item.get('content', '')[:1200]}
        for item in history[-6:]
        if isinstance(item, dict) and item.get('role') in ('user', 'assistant') and isinstance(item.get('content'), str)
    ]
    prompt = f'''Career context (may be incomplete):
{json.dumps(context, indent=2)}

Recent conversation:
{json.dumps(safe_history, indent=2)}

User question: {message.strip()}'''
    system = '''You are TARS, Slingshot's concise, practical career copilot. Help with programming, interview preparation, resumes, roadmap planning, applications, GitHub projects, and using this dashboard. Use the supplied career context when relevant; never invent resume facts, scores, completed work, or external links. If a question requires current external facts, say what should be verified. Give clear steps and examples. Keep answers under 300 words. Return only JSON in this exact shape: {"reply":"plain-text answer"}.'''
    try:
        result = openrouter_json(system, prompt, 0.35)
        reply = result.get('reply') if isinstance(result, dict) else None
        if not isinstance(reply, str) or not reply.strip():
            raise ValueError('TARS returned an invalid reply.')
        return jsonify(reply=reply.strip())
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='TARS is temporarily unavailable. Please try again shortly.'), 503


def generate_mock_interview(profile):
    prompt = f'''Create exactly two personalized technical mock-interview questions from this candidate profile:
{json.dumps(profile, indent=2)}

Question 1 must explore a project or experience in the profile. Question 2 must test practical understanding of a claimed technical skill. Do not invent profile details, ask personal-resume trivia, or give answers. Both questions require reasoning.
Return only JSON: {{"questions":[{{"id":1,"category":"project","question":"...","time_limit_seconds":120}},{{"id":2,"category":"technical","question":"...","time_limit_seconds":120}}]}}.'''
    result = openrouter_json('You are a professional technical interviewer. Return valid JSON only.', prompt, 0.4)
    questions = result.get('questions', [])
    if len(questions) != 2:
        raise ValueError('The interview generator must return exactly two questions.')
    return questions


def evaluate_interview_answer(profile, question, answer):
    prompt = f'''Evaluate this candidate answer to a technical interview question using only the question, answer, and profile.

PROFILE: {json.dumps(profile, indent=2)}
QUESTION: {question}
ANSWER: {answer}

Return only JSON with integer scores from 0 to 10: {{"score":0,"technical_accuracy":0,"communication":0,"relevance":0,"depth_of_understanding":0,"confidence":0,"strengths":["..."],"weaknesses":["..."],"feedback":"...","improvement":"..."}}.'''
    return openrouter_json('You are an objective, constructive technical interviewer. Return valid JSON only.', prompt, 0.2)


@app.post('/api/assessments/generate')
def create_assessment():
    body = request.get_json(silent=True) or {}
    profile, skill = body.get('profile'), body.get('skill')
    question_count = min(max(int(body.get('questionCount', 5)), 3), 10)
    if not isinstance(profile, dict) or not isinstance(skill, str) or not skill.strip():
        return jsonify(error='A structured profile and skill are required.'), 400
    try:
        return jsonify(questions=generate_questions(profile, skill.strip(), question_count))
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='The question generator is unavailable. Please try again shortly.'), 503


@app.post('/api/interviews/generate')
def create_mock_interview():
    body = request.get_json(silent=True) or {}
    profile = body.get('profile')
    if not isinstance(profile, dict):
        return jsonify(error='A structured profile is required.'), 400
    try:
        return jsonify(questions=generate_mock_interview(profile))
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='The interview generator is unavailable. Please try again shortly.'), 503
@app.post('/api/readiness/score')
def score_readiness():
    body = request.get_json(silent=True) or {}

    profile = body.get('profile')
    companies = body.get('companies')
    # Accept the original single-company request contract as well.
    if companies is None:
        companies = [body.get('company')] if body.get('company') else []

    if not isinstance(profile, dict) or not isinstance(companies, list) or not companies:
        return jsonify(error='A structured profile and at least one company are required.'), 400

    companies = [company.strip() for company in companies if isinstance(company, str) and company.strip()]
    if not companies:
        return jsonify(error='Companies must be non-empty names.'), 400

    try:
        results = [evaluate_readiness(profile, company) for company in companies]
        for company, result in zip(companies, results):
            if not isinstance(result, dict) or not isinstance(result.get('readiness_score'), (int, float)):
                raise ValueError(f'Invalid readiness result for {company}.')
        # `results` is the canonical CDC response; `matches` supports the
        # previous frontend naming during a rolling local-server restart.
        return jsonify(results=results, matches=results)
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='The readiness scoring service is unavailable. Please try again shortly.'), 503
def evaluate_readiness(profile, company):

    prompt = f"""
You are a placement readiness evaluator.

STUDENT PROFILE:
{json.dumps(profile, indent=2)}

TARGET COMPANY:
{company}

Evaluate how prepared the student is for this company.

Return JSON only:

{{
  "company":"{company}",
  "readiness_score":78,
  "category":"Reach",
  "strengths":[
    "...",
    "..."
  ],
  "missing_skills":[
    "...",
    "..."
  ],
  "recommended_next_steps":[
    "...",
    "..."
  ],
  "summary":"..."
}}
"""

    return openrouter_json(
        "You are an expert placement coach. Return valid JSON only.",
        prompt,
        0.2
    )


def validate_roadmap(roadmap):
    if not isinstance(roadmap, dict) or not isinstance(roadmap.get('phases'), list) or not roadmap['phases']:
        raise ValueError('Roadmap must include at least one phase.')
    phase_ids = set()
    for phase in roadmap['phases']:
        if not isinstance(phase, dict) or not isinstance(phase.get('id'), str) or not phase['id']:
            raise ValueError('Every roadmap phase needs an id.')
        if phase['id'] in phase_ids or not isinstance(phase.get('tracks'), list):
            raise ValueError('Roadmap phase ids must be unique and include tracks.')
        phase_ids.add(phase['id'])
        for track in phase['tracks']:
            if not isinstance(track, dict) or not isinstance(track.get('name'), str):
                raise ValueError('Every roadmap track must be an object with a name.')
            if track.get('name') == 'DSA' and not isinstance(track.get('leetcode_target'), (int, float)):
                raise ValueError('Every DSA track needs a numeric LeetCode target.')
    if not isinstance(roadmap.get('edges'), list):
        raise ValueError('Roadmap must include edges.')
    return roadmap


def fallback_career_roadmap(profile):
    time_text = profile.get('time_available', '').lower()
    weeks = 8 if '8 week' in time_text else 12 if '3 month' in time_text else 24 if '6 month' in time_text else 52 if '1 year' in time_text else 24
    is_experienced = '1–3' in profile.get('current_level', '') or '3+' in profile.get('current_level', '')
    dsa_total = 120 if weeks <= 8 else 180 if weeks <= 12 else 330 if weeks <= 24 else 430
    first = max(2, round(weeks * .35)); second = max(2, round(weeks * .35)); third = max(2, weeks - first - second)
    phases = [
        {'id': 'foundation', 'title': 'Foundation and problem-solving patterns', 'duration_weeks': first, 'tracks': [
            {'name': 'DSA', 'goals': [f'Solve {round(dsa_total*.40)} Arrays, Strings, Hashing and Linked List problems.', 'Complete complexity analysis and two-pointer, sliding-window and binary-search patterns.'], 'leetcode_target': round(dsa_total*.40), 'resources': ['NeetCode practice', 'Striver A2Z DSA Sheet']},
            {'name': 'CN', 'goals': ['Cover OSI and TCP/IP models, DNS, HTTP/HTTPS, and TCP vs UDP.'], 'leetcode_target': None, 'resources': ['GeeksforGeeks Computer Networks']},
            {'name': 'OS', 'goals': ['Explain processes vs threads, scheduling, memory management and deadlocks.'], 'leetcode_target': None, 'resources': ['GeeksforGeeks Operating Systems']},
        ], 'milestone': 'Solve foundational DSA patterns independently and explain core CS concepts.'},
        {'id': 'depth', 'title': 'Depth, implementation and timed practice', 'duration_weeks': second, 'tracks': [
            {'name': 'DSA', 'goals': [f'Solve {round(dsa_total*.40)} Tree, Graph, Heap and recursion/backtracking problems.', 'Complete 2 timed coding sessions every week.'], 'leetcode_target': round(dsa_total*.40), 'resources': ['LeetCode problem set']},
            {'name': 'Fullstack', 'goals': ['Build one deployable project with a frontend, API, database and authentication.', 'Document API endpoints and deployment steps.'], 'leetcode_target': None, 'resources': ['Full Stack Open']},
            {'name': 'System Design', 'goals': ['Practice OOP, SOLID principles, class diagrams and two low-level design exercises.'], 'leetcode_target': None, 'resources': ['System Design Primer']},
        ], 'milestone': 'Complete one demonstrable project and consistently solve medium-level problems.'},
        {'id': 'interview', 'title': 'Interview simulation and targeted revision', 'duration_weeks': third, 'tracks': [
            {'name': 'DSA', 'goals': [f'Solve the final {dsa_total-round(dsa_total*.80)} Dynamic Programming and mixed-review problems.', 'Run 3 mock coding interviews and revisit every weak topic.'], 'leetcode_target': dsa_total-round(dsa_total*.80), 'resources': ['NeetCode practice', 'LeetCode problem set']},
            {'name': 'System Design', 'goals': ['Practice two end-to-end design discussions covering APIs, databases, caching and scalability.' if is_experienced else 'Practice one entry-level system design discussion and explain trade-offs clearly.'], 'leetcode_target': None, 'resources': ['System Design Primer']},
            {'name': 'Aptitude', 'goals': ['Complete 3 quantitative and logical-reasoning sets if your target companies use aptitude rounds.'], 'leetcode_target': None, 'resources': ['IndiaBIX aptitude']},
        ], 'milestone': 'Be ready to simulate the full interview loop for the target role.'},
    ]
    return {'target_role': profile['target_role'], 'total_duration_weeks': weeks, 'phases': phases, 'edges': [{'from': 'foundation', 'to': 'depth'}, {'from': 'depth', 'to': 'interview'}]}


def generate_career_roadmap(profile):
    prompt = f'''You are a career roadmap generator for software engineering job seekers targeting Big Tech / large MNCs.

INPUT PROFILE:
{json.dumps(profile, indent=2)}

Generate a personalized phase-based plan from the current skills and level to the target role within the stated time available.
Cover DSA, CN, OS, System Design, Fullstack, and Aptitude/CS fundamentals where appropriate. DSA must include concrete topic-wise goals and total/per-topic LeetCode counts, scaled to time (roughly 300-450 for 6-12 months from scratch). Cover DSA basics and CN/OS before advanced DSA and system design. Split LLD/HLD; keep HLD light for freshers and deeper for 2+ years. Include aptitude only for relevant MNC-style rounds. Keep every goal measurable.

Return ONLY valid JSON matching exactly:
{{"target_role":"string","total_duration_weeks":number,"phases":[{{"id":"string","title":"string","duration_weeks":number,"tracks":[{{"name":"DSA|CN|OS|System Design|Fullstack|Aptitude","goals":["string"],"leetcode_target":number|null,"resources":["string"]}}],"milestone":"string"}}],"edges":[{{"from":"phase_id","to":"phase_id"}}]}}'''
    last_error = None
    for _ in range(2):
        try:
            return validate_roadmap(openrouter_json('You create practical, valid JSON career roadmaps. Return JSON only.', prompt, 0.35))
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            last_error = error
    # A malformed model response should not make the roadmap unusable. The
    # deterministic fallback keeps the same API schema and works offline.
    return fallback_career_roadmap(profile)


def valid_url(url):
    if not isinstance(url, str) or not url.startswith(('https://', 'http://')):
        return False
    try:
        response = requests.head(url, timeout=8, allow_redirects=True, headers={'User-Agent': 'SlingshotResourceValidator/1.0'})
        return response.status_code < 400
    except requests.RequestException:
        return False


def validate_resources(data):
    required = ('topic', 'course', 'video', 'leetcode_links')
    if not isinstance(data, dict) or any(key not in data for key in required):
        raise ValueError('Resource response does not match the expected schema.')
    for key in ('course', 'video'):
        if not isinstance(data[key], dict) or not valid_url(data[key].get('url')):
            raise ValueError(f'Could not verify the {key} URL.')
    data['leetcode_links'] = [item for item in data['leetcode_links'] if isinstance(item, dict) and valid_url(item.get('url'))]
    # CN, OS and system-design topics may correctly have no LeetCode exercise.
    # For DSA-like topics the model is still instructed to provide real links.
    if isinstance(data.get('practice_sheet'), dict) and not valid_url(data['practice_sheet'].get('url')):
        data['practice_sheet'] = None
    return data


def curate_resources(topic, level):
    cache_key = f'{topic.strip().lower()}:{level.strip().lower()}'
    cached = RESOURCE_CACHE.get(cache_key)
    if cached and time.time() - cached['created_at'] < 172800:
        return cached['data']
    tavily_key = os.getenv('TAVILY_API_KEY')
    if not tavily_key:
        raise ValueError('Live resource research needs TAVILY_API_KEY configured on the server.')
    search_response = requests.post('https://api.tavily.com/search', json={'api_key': tavily_key, 'query': f'best free {topic} interview preparation course video LeetCode resources {level}', 'search_depth': 'advanced', 'max_results': 8, 'include_answer': False}, timeout=30)
    search_response.raise_for_status()
    sources = [{'title': item.get('title'), 'url': item.get('url'), 'content': item.get('content', '')[:1000]} for item in search_response.json().get('results', [])]
    if not sources:
        raise ValueError('Web search returned no resources for this topic.')
    prompt = f'''You are a study-resource curator. Use ONLY these live web-search results to curate resources for topic "{topic}" at {level} level: {json.dumps(sources, indent=2)}. Never invent a URL or use a URL not in the sources. Prioritize free and widely recommended sources. Return only JSON: {{"topic":"string","course":{{"title":"string","url":"string","source":"string","note":"one line"}},"video":{{"title":"string","url":"string","channel":"string","note":"one line"}},"practice_sheet":{{"title":"string","url":"string","note":"one line"}}|null,"leetcode_links":[{{"title":"string","url":"string","difficulty":"Easy|Medium|Hard"}}]}}. Include 3-6 direct LeetCode pages only when present in sources; otherwise return an empty list.'''
    data = validate_resources(openrouter_json('Return valid JSON only and use only supplied URLs.', prompt, 0.1))
    RESOURCE_CACHE[cache_key] = {'created_at': time.time(), 'data': data}
    return data


def analyze_readiness(activity):
    prompt = f'''You are an interview-readiness analyst. Produce an honest evidence-based assessment strictly from this activity JSON. Mock interviews have the most weight. Do not inflate scores, and say confidence is low if activity is thin. Return only JSON exactly with overall_readiness_pct (0-100), confidence (low|medium|high), tracks ([{{name,completion_pct,verified_score_pct,status}}]), weak_areas ([{{topic,evidence}}]), next_actions (3-5 concrete actions), and trend ({{direction,note}}).\n\nACTIVITY:\n{json.dumps(activity, indent=2)}'''
    result = openrouter_json('You give deterministic, data-grounded readiness assessments. Return JSON only.', prompt, 0.1)
    if not isinstance(result, dict) or not isinstance(result.get('tracks'), list):
        raise ValueError('Readiness analysis was invalid.')
    return result


@app.post('/api/roadmaps/generate')
def create_career_roadmap():
    body = request.get_json(silent=True) or {}
    profile = body.get('profile')
    if not isinstance(profile, dict):
        return jsonify(error='A roadmap profile is required.'), 400
    required = ('current_skills', 'current_level', 'target_role', 'time_available')
    if any(not isinstance(profile.get(key), str) or not profile[key].strip() for key in required):
        return jsonify(error='Current skills, level, target role, and time available are required.'), 400
    try:
        return jsonify(generate_career_roadmap(profile))
    except (ValueError, KeyError, TypeError, AttributeError, json.JSONDecodeError) as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='The roadmap generator is unavailable. Please try again shortly.'), 503


@app.post('/api/resources/curate')
def create_resource_list():
    body = request.get_json(silent=True) or {}
    topic, level = body.get('topic'), body.get('level', 'beginner')
    if not isinstance(topic, str) or not topic.strip() or level not in ('beginner', 'intermediate', 'advanced'):
        return jsonify(error='A topic and valid level are required.'), 400
    try:
        return jsonify(curate_resources(topic, level))
    except ValueError as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='Live resource search is unavailable. Please try again shortly.'), 503


@app.post('/api/readiness/analyze')
def create_readiness_analysis():
    activity = (request.get_json(silent=True) or {}).get('activity')
    if not isinstance(activity, dict):
        return jsonify(error='Activity data is required.'), 400
    try:
        return jsonify(analyze_readiness(activity))
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='Readiness analysis is unavailable. Please try again shortly.'), 503

@app.post('/api/interviews/evaluate')
def evaluate_mock_interview_answer():
    body = request.get_json(silent=True) or {}
    profile, question, answer = body.get('profile'), body.get('question'), body.get('answer')
    if not isinstance(profile, dict) or not isinstance(question, str) or not isinstance(answer, str) or not answer.strip():
        return jsonify(error='A profile, question, and answer are required.'), 400
    try:
        return jsonify(evaluation=evaluate_interview_answer(profile, question, answer))
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        return jsonify(error=str(error)), 502
    except requests.RequestException:
        return jsonify(error='The interview evaluator is unavailable. Please try again shortly.'), 503

print("\nREGISTERED ROUTES:")
print(app.url_map)
if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', '3000')),
        debug=os.getenv('FLASK_DEBUG') == '1',
        use_reloader=False,
    )
