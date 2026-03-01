from app.config import INTERVIEW_SYSTEM_TEMPLATE


def test_interview_template_renders_jd_and_resume():
    rendered = INTERVIEW_SYSTEM_TEMPLATE.format(
        jd_text="Sample JD content",
        resume_text="Sample resume content",
    )
    assert "Sample JD content" in rendered
    assert "Sample resume content" in rendered
    assert "=== JOB DESCRIPTION ===" in rendered
    assert "=== CANDIDATE RESUME ===" in rendered
