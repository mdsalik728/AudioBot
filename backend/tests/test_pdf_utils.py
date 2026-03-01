import os
import pytest
from app.context.pdf_utils import (
    extract_pdf_text_from_path,
    extract_pdf_text_from_bytes,
    InvalidPDFError,
    EmptyPDFTextError,
    PDFReadError,
)


def test_extract_pdf_text_from_path_returns_text():
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    jd_path = os.path.join(backend_dir, "notebooks", "Job Description - HR Intern.pdf")
    text = extract_pdf_text_from_path(jd_path)
    assert isinstance(text, str)
    assert len(text) > 100


def test_extract_pdf_text_from_bytes_rejects_non_pdf():
    with pytest.raises(InvalidPDFError):
        extract_pdf_text_from_bytes(b"not-a-pdf")


def test_extract_pdf_text_from_bytes_rejects_empty_pdf_signature_only():
    with pytest.raises((EmptyPDFTextError, PDFReadError)):
        extract_pdf_text_from_bytes(b"%PDF")
