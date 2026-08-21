import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Resolve the project's .env rather than relying on the PowerShell working directory.
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

app = Flask(__name__)
CORS(app)

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
MODEL = 'qwen/qwen3-30b-a3b'


@app.get('/api/health')
def health_check():
    return jsonify(
        service='slingshot-assessment-api',
        openrouterConfigured=bool(os.getenv('OPENROUTER_API_KEY')),
    )


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
    content = response.json()['choices'][0]['message']['content'].replace('```json', '').replace('```', '').strip()
    return json.loads(content)


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


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', '3000')),
        debug=os.getenv('FLASK_DEBUG') == '1',
        use_reloader=False,
    )
