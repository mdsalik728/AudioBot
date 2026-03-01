import os
from dotenv import load_dotenv

APP_DIR = os.path.dirname(__file__)
PROJECT_BACKEND_DIR = os.path.dirname(APP_DIR)

# Load environment variables from:
# 1) explicit ENV_FILE path, then
# 2) backend/.env, then
# 3) backend/app/.env (legacy path for local dev)
env_file = os.getenv("ENV_FILE")
if env_file:
    load_dotenv(dotenv_path=env_file, override=False)
else:
    load_dotenv(dotenv_path=os.path.join(PROJECT_BACKEND_DIR, ".env"), override=False)
    load_dotenv(dotenv_path=os.path.join(APP_DIR, ".env"), override=False)

# LLM configuration
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
LANGSMITH_TRACING = os.getenv("LANGSMITH_TRACING", "false").lower() == "true"
LANGSMITH_ENDPOINT = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "audiobot")

# Prompt template configuration
INTERVIEW_SYSTEM_TEMPLATE = """You are an HR interviewer assessing cultural fit.
You have been provided with the Job Description and the Candidate's Resume below.
Use both to tailor your interview questions.

=== JOB DESCRIPTION ===
{jd_text}

=== CANDIDATE RESUME ===
{resume_text}

Begin by understanding the candidate's background: personal overview, family background,
and educational journey. Ask one question at a time. After gathering this context, ask
relevant follow-up questions based on their responses to assess personality, values,
teamwork, communication style, adaptability, accountability, and conflict handling.

Use behavioral and situational questions when appropriate.
If answers are vague, ask clarifying follow-ups.
Maintain a professional and neutral tone.
Do not provide feedback or evaluations during the interview."""

DEFAULT_SYSTEM_PROMPT = INTERVIEW_SYSTEM_TEMPLATE.format(
    jd_text="Job Description not available.",
    resume_text="Resume not provided yet.",
)

# Audio configuration
STT_MODEL = "base"
TTS_MODEL = "en-US-AvaNeural"

# Redis configuration
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}")

# Context storage/configuration
CONTEXT_TTL_SECONDS = int(os.getenv("CONTEXT_TTL_SECONDS", "1800"))
DEFAULT_JD_PATH = os.getenv(
    "DEFAULT_JD_PATH",
    os.path.join(PROJECT_BACKEND_DIR, "notebooks", "Job Description - HR Intern.pdf"),
)
MAX_PDF_MB = int(os.getenv("MAX_PDF_MB", "10"))

# Application settings
APP_NAME = "AudioBot - Conversational AI"
APP_VERSION = "0.2.0"
APP_ENV = os.getenv("APP_ENV", "development")
