import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY1"))

def generate_text(prompt: str) -> str:
    '''사용자의 입력(propmpt)을 받아 AI가 텍스트를 생성합니다.'''
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI writing assistant that helps users improve and extend text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error generating text: {str(e)}"