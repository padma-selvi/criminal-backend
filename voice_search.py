import sys
import json
import os
import warnings
from pathlib import Path

# ============================================================
# SETTINGS
# ============================================================

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent

MODEL_DIR = (
    Path.home()
    / "speechbrain_models"
    / "spkrec-ecapa-voxceleb"
)

MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True
)

# ============================================================
# LOG HELPER
# ============================================================

def log(message):
    print(
        message,
        file=sys.stderr,
        flush=True
    )


log("====================================")
log("🐍 VOICE PYTHON STARTED")
log("====================================")
log(f"📁 BASE DIR: {BASE_DIR}")
log(f"📁 MODEL DIR: {MODEL_DIR}")


# ============================================================
# JSON RESULT
# ============================================================

def send_result(
    success=False,
    match=False,
    score=0,
    message=""
):
    result = {
        "success": bool(success),
        "match": bool(match),
        "score": float(score),
        "message": str(message)
    }

    print(
        json.dumps(result),
        flush=True
    )


# ============================================================
# IMPORT SPEECHBRAIN
# ============================================================

try:

    log("📦 Importing SpeechBrain...")

    from speechbrain.inference.speaker import (
        SpeakerRecognition
    )

    from speechbrain.utils.fetching import (
        LocalStrategy
    )

    log(
        "✅ SpeechBrain imported successfully."
    )

except Exception as e:

    log(
        "❌ SpeechBrain import failed."
    )

    log(str(e))

    send_result(
        success=False,
        match=False,
        score=0,
        message=(
            f"SpeechBrain import error: {str(e)}"
        )
    )

    sys.exit(1)


# ============================================================
# LOAD ECAPA MODEL
# ============================================================

try:

    log("====================================")
    log("🧠 LOADING ECAPA MODEL")
    log("====================================")

    verifier = (
        SpeakerRecognition.from_hparams(
            source="speechbrain/"
                   "spkrec-ecapa-voxceleb",

            savedir=str(MODEL_DIR),

            local_strategy=LocalStrategy.COPY
        )
    )

    log(
        "✅ SpeechBrain ECAPA model "
        "loaded successfully."
    )

except Exception as e:

    log(
        "❌ Model loading failed."
    )

    log(str(e))

    send_result(
        success=False,
        match=False,
        score=0,
        message=(
            f"Model load error: {str(e)}"
        )
    )

    sys.exit(1)


# ============================================================
# CLEAN AUDIO PATH
# ============================================================

def clean_path(value):

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    # Remove accidental quotes
    value = value.strip('"')
    value = value.strip("'")

    # Normalize Windows slashes
    value = value.replace("/", "\\")

    try:

        path_obj = Path(value)

        # --------------------------------------------
        # ABSOLUTE PATH
        # --------------------------------------------

        if path_obj.is_absolute():

            result = path_obj.resolve()

        # --------------------------------------------
        # RELATIVE PATH
        # --------------------------------------------

        else:

            result = (
                BASE_DIR / path_obj
            ).resolve()

        log(
            f"🔎 CLEAN PATH: {result}"
        )

        return result

    except Exception as e:

        log(
            f"❌ Path conversion error: {e}"
        )

        return None


# ============================================================
# CHECK AUDIO FILE
# ============================================================

def check_audio(value):

    audio_path = clean_path(value)

    if audio_path is None:

        log(
            "❌ Empty audio path."
        )

        return None

    log("------------------------------------")
    log(
        f"🎵 AUDIO: {audio_path}"
    )
    log("------------------------------------")

    # --------------------------------------------
    # EXISTS
    # --------------------------------------------

    if not audio_path.exists():

        log(
            "❌ Audio file does not exist:\n"
            f"{audio_path}"
        )

        return None

    # --------------------------------------------
    # FILE
    # --------------------------------------------

    if not audio_path.is_file():

        log(
            "❌ Audio path is not a file:\n"
            f"{audio_path}"
        )

        return None

    # --------------------------------------------
    # SIZE
    # --------------------------------------------

    try:

        size = audio_path.stat().st_size

        log(
            f"📦 Audio size: {size} bytes"
        )

        if size <= 0:

            log(
                "❌ Audio file is empty."
            )

            return None

    except Exception as e:

        log(
            f"❌ Audio stat error: {e}"
        )

        return None

    # --------------------------------------------
    # EXTENSION
    # --------------------------------------------

    allowed_extensions = [
        ".wav",
        ".mp3",
        ".ogg",
        ".flac",
        ".m4a",
        ".webm"
    ]

    extension = (
        audio_path.suffix.lower()
    )

    log(
        f"📄 Extension: {extension}"
    )

    if extension not in allowed_extensions:

        log(
            f"⚠️ Unknown audio extension: "
            f"{extension}"
        )

    log(
        "✅ Audio file valid."
    )

    return audio_path


# ============================================================
# CONVERT TO SPEECHBRAIN-SAFE RELATIVE PATH
# ============================================================

def speechbrain_path(audio_path):

    """
    SpeechBrain on this Windows setup is
    incorrectly prefixing BASE_DIR when an
    absolute Windows path is supplied.

    Therefore we pass a relative path such as:

        uploads/test.wav

    instead of:

        D:\\criminal-face-system\\src\\backend\\uploads\\test.wav
    """

    try:

        relative_path = (
            audio_path.resolve()
            .relative_to(
                BASE_DIR.resolve()
            )
        )

        result = str(
            relative_path
        ).replace("\\", "/")

        log(
            f"🔗 SPEECHBRAIN RELATIVE PATH: "
            f"{result}"
        )

        return result

    except ValueError:

        # If the file is outside BASE_DIR,
        # fall back to filename/path string.

        result = str(
            audio_path
        ).replace("\\", "/")

        log(
            f"⚠️ Audio outside BASE_DIR:"
            f" {result}"
        )

        return result


# ============================================================
# COMPARE TWO VOICES
# ============================================================

def compare_voice(
    query_path,
    candidate_path
):

    log("====================================")
    log("🎙️ VOICE COMPARISON")
    log("====================================")

    # ========================================================
    # QUERY
    # ========================================================

    query = check_audio(
        query_path
    )

    if query is None:

        raise RuntimeError(
            "Query audio file not found: "
            f"{query_path}"
        )

    # ========================================================
    # CANDIDATE
    # ========================================================

    candidate = check_audio(
        candidate_path
    )

    if candidate is None:

        raise RuntimeError(
            "Candidate audio file not found: "
            f"{candidate_path}"
        )

    log(
        f"🎧 QUERY     : {query}"
    )

    log(
        f"🎙️ CANDIDATE : {candidate}"
    )

    # ========================================================
    # VERIFY FILES EXIST
    # ========================================================

    if not query.is_file():

        raise RuntimeError(
            f"Query file missing: {query}"
        )

    if not candidate.is_file():

        raise RuntimeError(
            f"Candidate file missing: {candidate}"
        )

    # ========================================================
    # IMPORTANT
    # SPEECHBRAIN GETS RELATIVE PATHS
    # ========================================================

    query_for_speechbrain = (
        speechbrain_path(query)
    )

    candidate_for_speechbrain = (
        speechbrain_path(candidate)
    )

    log("------------------------------------")
    log(
        "🎧 STARTING SPEECHBRAIN COMPARISON"
    )
    log("------------------------------------")

    log(
        f"Query absolute path:\n{query}"
    )

    log(
        f"Candidate absolute path:\n{candidate}"
    )

    log(
        f"Query SpeechBrain path:\n"
        f"{query_for_speechbrain}"
    )

    log(
        f"Candidate SpeechBrain path:\n"
        f"{candidate_for_speechbrain}"
    )

    # ========================================================
    # SPEECHBRAIN VERIFY
    # ========================================================

    try:

        score, prediction = (
            verifier.verify_files(
                query_for_speechbrain,
                candidate_for_speechbrain
            )
        )

    except Exception as e:

        log(
            "❌ SpeechBrain verify_files ERROR"
        )

        log(str(e))

        raise RuntimeError(
            "SpeechBrain audio error: "
            f"{str(e)}"
        )

    # ========================================================
    # SCORE CONVERSION
    # ========================================================

    try:

        if hasattr(
            score,
            "item"
        ):

            score_value = float(
                score.item()
            )

        elif hasattr(
            score,
            "__len__"
        ):

            score_value = float(
                score[0]
            )

        else:

            score_value = float(
                score
            )

    except Exception as e:

        log(
            f"❌ Score conversion error: {e}"
        )

        score_value = 0.0

    # ========================================================
    # PREDICTION CONVERSION
    # ========================================================

    try:

        if hasattr(
            prediction,
            "item"
        ):

            prediction_value = bool(
                prediction.item()
            )

        elif hasattr(
            prediction,
            "__len__"
        ):

            prediction_value = bool(
                prediction[0]
            )

        else:

            prediction_value = bool(
                prediction
            )

    except Exception:

        prediction_value = False

    # ========================================================
    # LOG RESULTS
    # ========================================================

    log("------------------------------------")

    log(
        f"📊 RAW SCORE       : {score}"
    )

    log(
        f"📊 SCORE           : {score_value}"
    )

    log(
        f"🤖 PREDICTION      : "
        f"{prediction_value}"
    )

    log("------------------------------------")

    # ========================================================
    # MATCH THRESHOLD
    # ========================================================

    THRESHOLD = 0.10

    match_value = (
        score_value >= THRESHOLD
    )

    log(
        f"🎯 THRESHOLD       : "
        f"{THRESHOLD}"
    )

    log(
        f"🎯 MATCH            : "
        f"{match_value}"
    )

    return (
        score_value,
        match_value
    )


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    try:

        log("====================================")
        log("🎙️ VOICE SEARCH")
        log("====================================")

        # ====================================================
        # ARGUMENT COUNT
        # ====================================================

        argument_count = (
            len(sys.argv) - 1
        )

        log(
            "📌 Arguments received: "
            f"{argument_count}"
        )

        # ====================================================
        # PRINT ARGUMENTS
        # ====================================================

        for index, argument in enumerate(
            sys.argv[1:],
            start=1
        ):

            log(
                f"ARG {index}: {argument}"
            )

        # ====================================================
        # CHECK ARGUMENTS
        # ====================================================

        if len(sys.argv) < 3:

            log(
                "❌ Query and candidate "
                "audio paths are required."
            )

            send_result(
                success=False,
                match=False,
                score=0,
                message=(
                    "Query and candidate "
                    "audio paths required"
                )
            )

            sys.exit(1)

        # ====================================================
        # GET INPUTS
        # ====================================================

        query_path = sys.argv[1]

        candidate_path = sys.argv[2]

        log(
            "🎧 Query input:\n"
            f"{query_path}"
        )

        log(
            "🎙️ Candidate input:\n"
            f"{candidate_path}"
        )

        # ====================================================
        # COMPARE
        # ====================================================

        score, is_match = (
            compare_voice(
                query_path,
                candidate_path
            )
        )

        # ====================================================
        # SUCCESS
        # ====================================================

        log("====================================")
        log(
            "✅ VOICE COMPARISON COMPLETED"
        )
        log("====================================")

        log(
            f"📊 FINAL SCORE: {score}"
        )

        log(
            f"🎯 FINAL MATCH: {is_match}"
        )

        send_result(
            success=True,
            match=is_match,
            score=score,
            message=(
                "Voice comparison completed"
            )
        )

        sys.exit(0)

    except Exception as e:

        # ====================================================
        # FINAL ERROR
        # ====================================================

        log("====================================")
        log(
            "❌ VOICE SEARCH FAILED"
        )
        log("====================================")

        log(
            f"ERROR: {str(e)}"
        )

        send_result(
            success=False,
            match=False,
            score=0,
            message=str(e)
        )

        sys.exit(1)