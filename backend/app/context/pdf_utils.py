import io
import os


class PDFProcessingError(Exception):
    """Base class for PDF processing errors."""


class InvalidPDFError(PDFProcessingError):
    """Raised when file is not a valid PDF."""


class EmptyPDFTextError(PDFProcessingError):
    """Raised when no text can be extracted from a PDF."""


class PDFReadError(PDFProcessingError):
    """Raised when PDF cannot be read/parsed."""


def _extract_text(pdf) -> str:
    text = "\n".join(page.extract_text() for page in pdf.pages if page.extract_text())
    cleaned = text.strip()
    if not cleaned:
        raise EmptyPDFTextError("No readable text found in PDF.")
    return cleaned


def extract_pdf_text_from_path(pdf_path: str) -> str:
    if not pdf_path.lower().endswith(".pdf"):
        raise InvalidPDFError("Only PDF files are supported.")
    if not os.path.exists(pdf_path):
        raise PDFReadError(f"File not found: {pdf_path}")

    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            return _extract_text(pdf)
    except PDFProcessingError:
        raise
    except Exception as exc:
        raise PDFReadError(f"Failed to read PDF from path: {exc}") from exc


def extract_pdf_text_from_bytes(data: bytes) -> str:
    if not data:
        raise InvalidPDFError("Uploaded file is empty.")
    if not data.startswith(b"%PDF"):
        raise InvalidPDFError("Uploaded file is not a valid PDF.")

    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return _extract_text(pdf)
    except PDFProcessingError:
        raise
    except Exception as exc:
        raise PDFReadError(f"Failed to read uploaded PDF: {exc}") from exc
