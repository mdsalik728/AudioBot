from __future__ import annotations

import logging
from fastapi import (
    FastAPI,
    WebSocket,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from app.websocket import websocket_handler
from app.config import (
    APP_NAME,
    APP_VERSION,
    DEFAULT_JD_PATH,
    MAX_PDF_MB,
)
from app.memory.store import MemoryStore
from app.context.store import ContextStore
from app.context.pdf_utils import (
    extract_pdf_text_from_path,
    extract_pdf_text_from_bytes,
    InvalidPDFError,
    EmptyPDFTextError,
    PDFReadError,
)

logger = logging.getLogger(__name__)

app = FastAPI(title=APP_NAME, version=APP_VERSION)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memory = MemoryStore()
context_store = ContextStore()


@app.on_event("startup")
def preload_default_jd():
    try:
        jd_text = extract_pdf_text_from_path(DEFAULT_JD_PATH)
        context_store.set_default_jd(jd_text)
        logger.info("Default JD loaded successfully from '%s'.", DEFAULT_JD_PATH)
    except Exception as exc:
        logger.error("Failed to preload default JD from '%s': %s", DEFAULT_JD_PATH, exc)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_handler(websocket)


def _validate_and_extract_pdf(file: UploadFile, payload: bytes) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    file_name = file.filename.lower()
    if not file_name.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    if len(payload) > MAX_PDF_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_PDF_MB}MB limit.")

    try:
        return extract_pdf_text_from_bytes(payload)
    except (InvalidPDFError, EmptyPDFTextError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PDFReadError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# -----------------------
# Context API
# -----------------------

@app.get("/context/status")
def get_context_status(conversation_id: str = Query(...)):
    status = context_store.get_context_status(conversation_id)
    logger.info("Context status fetched for conversation '%s': %s", conversation_id, status)
    return status


@app.post("/context/resume/upload")
async def upload_resume(
    conversation_id: str = Form(...),
    file: UploadFile = File(...),
):
    payload = await file.read()
    extracted_text = _validate_and_extract_pdf(file, payload)

    try:
        context_store.set_resume(conversation_id, extracted_text)
        logger.info(
            "Resume uploaded for conversation '%s' with %s extracted chars.",
            conversation_id,
            len(extracted_text),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to store resume: {exc}") from exc

    return {
        "ok": True,
        "conversation_id": conversation_id,
        "chars_extracted": len(extracted_text),
        "message": "Resume uploaded and processed successfully.",
    }


@app.post("/context/jd/upload")
async def upload_jd_override(
    conversation_id: str = Form(...),
    file: UploadFile = File(...),
):
    payload = await file.read()
    extracted_text = _validate_and_extract_pdf(file, payload)

    try:
        context_store.set_jd_override(conversation_id, extracted_text)
        logger.info(
            "JD override uploaded for conversation '%s' with %s extracted chars.",
            conversation_id,
            len(extracted_text),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to store JD override: {exc}") from exc

    return {
        "ok": True,
        "conversation_id": conversation_id,
        "chars_extracted": len(extracted_text),
        "message": "JD override uploaded and processed successfully.",
    }


@app.delete("/context/jd/override")
def reset_jd_override(conversation_id: str = Query(...)):
    try:
        context_store.delete_jd_override(conversation_id)
        logger.info("JD override removed for conversation '%s'.", conversation_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to remove JD override: {exc}") from exc

    return {
        "ok": True,
        "conversation_id": conversation_id,
        "message": "JD override removed. Default JD will be used.",
    }


# -----------------------
# Admin API (Read-only)
# -----------------------

@app.get("/admin/conversations")
def list_conversations():
    """
    Returns all known conversation IDs.
    """
    return {
        "conversations": memory.list_conversations()
    }


@app.get("/admin/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    """
    Returns the conversation history for a given ID.
    """
    conversation = memory.get_conversation(conversation_id)

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "conversation_id": conversation_id,
        "messages": conversation
    }


# -----------------------
# Monitoring / Health API
# -----------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/redis")
def health_redis():
    try:
        memory.client.ping()
        return {"redis": "connected"}
    except Exception:
        raise HTTPException(status_code=500, detail="Redis not reachable")


@app.get("/health/llm")
def health_llm():
    try:
        # Minimal LLM ping
        from langchain_groq import ChatGroq
        from app.config import GROQ_MODEL
        llm = ChatGroq(model=GROQ_MODEL)
        llm.invoke("Hi")
        return {"llm": "reachable"}
    except Exception:
        raise HTTPException(status_code=500, detail="LLM not reachable")
