# RAG Legal Backend (hackatón)

## Setup (local)
1. create env:
   export OPENAI_API_KEY="sk-..."
   export USE_OPENAI_EMB="yes"
   export CHROMA_PERSIST_DIR="./chroma_db"
2. pip install -r requirements.txt
3. mkdir docs_raw
4. python -m uvicorn main:app --reload --port 8000

## Endpoints
POST /upload (multipart file) -> { status, filename, chunks_indexed }
POST /ingest -> reindex docs_raw
POST /query -> { question, top_k } returns { answer, citations }

