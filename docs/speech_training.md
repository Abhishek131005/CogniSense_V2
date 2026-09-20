# Minimal Speech Training Setup

This project uses one public corpus for the first speech model: **Mozilla Common Voice**.
Do not combine datasets until this baseline has been evaluated.

## Model choices

- **ASR/transcription:** `openai/whisper-small`
- **Proxy labels:** `IsolationForest`
- **Risk model:** `StandardScaler` + `LogisticRegression`

There are no clinical labels. The proxy labels represent deviations from the public
speech corpus, so the result is an experimental screening score and not a diagnosis.

## 1. Download Common Voice

Download the Common Voice language packs you need from the official Mozilla Common
Voice release page. Start with Hindi and Marathi, then add other Indian languages
required by the application. Keep the extracted audio under one directory, for example:

```text
C:\speech_data\common_voice\
    hi\
        clips\
    mr\
        clips\
    ta\
        clips\
```

The trainer recursively finds `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`, `.webm`, and
`.aac` files. It converts audio to mono 16 kHz while extracting features.

## 2. Install dependencies

From the `backend` directory:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install joblib pyarrow
```

## 3. Run a small smoke test

Whisper downloads on its first use. Use a small limit first:

```powershell
$env:COGNISENSE_ENABLE_ASR="true"
$env:COGNISENSE_ASR_MODEL="openai/whisper-small"
.\.venv\Scripts\python.exe .\train\train_public_speech_screening.py `
  --dataset-root "C:\speech_data\common_voice" `
  --sample-limit 100 `
  --language auto
```

For a CPU-only machine, use `openai/whisper-base` or `openai/whisper-tiny` first.

## 4. Train the complete baseline

Set `--sample-limit 0` or omit it. Zero means all audio files:

```powershell
.\.venv\Scripts\python.exe .\train\train_public_speech_screening.py `
  --dataset-root "C:\speech_data\common_voice" `
  --sample-limit 0 `
  --language auto `
  --contamination 0.15 `
  --test-size 0.2
```

The output is written to:

```text
backend\models\public_speech\
    public_speech_screening_model.joblib
    public_speech_screening_report.json
    feature_columns.json
```

## 5. Enable the trained model

Before starting FastAPI, point the backend at the generated model:

```powershell
$env:COGNISENSE_SPEECH_SCREENING_MODEL="C:\Users\Gargi Shintre\Gargi\Projects\CogniSense_BE_Capstone\CogniSense_V2\backend\models\public_speech\public_speech_screening_model.joblib"
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Check `/speech/health`. `screening_model_loaded` must be `true`, and speech analysis
must report `CogniSense public-data screening model` in `model_used`.

## Interpretation

Evaluate the report only against its pseudo-labels. It does not measure dementia
classification performance. Do not use the score for diagnosis or medical decisions.