import logging
from typing import Dict
import redis
from app.config import (
    REDIS_HOST,
    REDIS_PORT,
    REDIS_DB,
    CONTEXT_TTL_SECONDS,
)

logger = logging.getLogger(__name__)


class ContextStore:
    DEFAULT_JD_KEY = "context:jd:default"
    JD_OVERRIDE_PREFIX = "context:jd:override:"
    RESUME_PREFIX = "context:resume:"

    def __init__(
        self,
        host: str = REDIS_HOST,
        port: int = REDIS_PORT,
        db: int = REDIS_DB,
        ttl_seconds: int = CONTEXT_TTL_SECONDS,
    ):
        self.client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True,
        )
        self.client.ping()
        self.ttl_seconds = ttl_seconds

    def _jd_override_key(self, conversation_id: str) -> str:
        return f"{self.JD_OVERRIDE_PREFIX}{conversation_id}"

    def _resume_key(self, conversation_id: str) -> str:
        return f"{self.RESUME_PREFIX}{conversation_id}"

    def set_default_jd(self, text: str):
        self.client.set(self.DEFAULT_JD_KEY, text)

    def get_default_jd(self) -> str:
        return self.client.get(self.DEFAULT_JD_KEY) or ""

    def set_jd_override(self, conversation_id: str, text: str):
        self.client.setex(self._jd_override_key(conversation_id), self.ttl_seconds, text)

    def delete_jd_override(self, conversation_id: str):
        self.client.delete(self._jd_override_key(conversation_id))

    def get_jd(self, conversation_id: str) -> str:
        override = self.client.get(self._jd_override_key(conversation_id))
        if override:
            return override
        return self.get_default_jd()

    def set_resume(self, conversation_id: str, text: str):
        self.client.setex(self._resume_key(conversation_id), self.ttl_seconds, text)

    def get_resume(self, conversation_id: str) -> str:
        return self.client.get(self._resume_key(conversation_id)) or ""

    def get_context_status(self, conversation_id: str) -> Dict[str, object]:
        jd_override = self.client.get(self._jd_override_key(conversation_id))
        resume = self.client.get(self._resume_key(conversation_id))
        default_jd = self.get_default_jd()
        jd_value = jd_override if jd_override is not None else default_jd

        return {
            "default_jd_loaded": bool(default_jd),
            "jd_override_present": bool(jd_override),
            "resume_present": bool(resume),
            "resume_chars": len(resume or ""),
            "jd_chars": len(jd_value or ""),
        }
