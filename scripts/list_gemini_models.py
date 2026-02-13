
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

api_key = os.getenv('AI_API_KEY')
if not api_key:
    print("❌ No API Key found.")
    exit(1)

genai.configure(api_key=api_key)

print("🔍 Listing Available Gemini Models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"❌ Error listing models: {e}")
