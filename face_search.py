import sys
import json
import os
import cv2
import numpy as np


# =====================================================
# PATHS
# =====================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "face_models"
)

YUNET_MODEL = os.path.join(
    MODEL_DIR,
    "face_detection_yunet_2023mar.onnx"
)

SFACE_MODEL = os.path.join(
    MODEL_DIR,
    "face_recognition_sface_2021dec.onnx"
)


# =====================================================
# SEND JSON RESULT
# =====================================================

def send_result(data):
    print(json.dumps(data))
    sys.stdout.flush()


# =====================================================
# LOG TO STDERR
# =====================================================

def log(message):
    print(message, file=sys.stderr, flush=True)


# =====================================================
# CHECK MODEL FILES
# =====================================================

if not os.path.isfile(YUNET_MODEL):
    send_result({
        "success": False,
        "message": "YuNet model file not found",
        "path": YUNET_MODEL
    })
    sys.exit(1)


if not os.path.isfile(SFACE_MODEL):
    send_result({
        "success": False,
        "message": "SFace model file not found",
        "path": SFACE_MODEL
    })
    sys.exit(1)


# =====================================================
# CREATE FACE DETECTOR
# =====================================================

try:
    detector = cv2.FaceDetectorYN.create(
        YUNET_MODEL,
        "",
        (320, 320),
        0.40,
        0.3,
        5000
    )

except Exception as error:
    send_result({
        "success": False,
        "message": f"Face detector could not be loaded: {error}"
    })
    sys.exit(1)


# =====================================================
# CREATE FACE RECOGNIZER
# =====================================================

try:
    recognizer = cv2.FaceRecognizerSF.create(
        SFACE_MODEL,
        ""
    )

except Exception as error:
    send_result({
        "success": False,
        "message": f"Face recognizer could not be loaded: {error}"
    })
    sys.exit(1)


# =====================================================
# READ IMAGE SAFELY
# =====================================================

def read_image_safe(image_path):

    if not image_path:
        return None

    try:

        image_path = os.path.normpath(
            os.path.abspath(image_path)
        )

        # ---------------------------------------------
        # FILE EXISTENCE
        # ---------------------------------------------

        if not os.path.isfile(image_path):

            log(
                f"⚠️ Image file not found: {image_path}"
            )

            return None

        # ---------------------------------------------
        # FILE SIZE
        # ---------------------------------------------

        file_size = os.path.getsize(image_path)

        if file_size <= 0:

            log(
                f"⚠️ Image file is empty: {image_path}"
            )

            return None

        # ---------------------------------------------
        # READ RAW BYTES
        # ---------------------------------------------

        with open(
            image_path,
            "rb"
        ) as file:

            image_bytes = file.read()

        if not image_bytes:

            log(
                f"⚠️ Unable to read image bytes: {image_path}"
            )

            return None

        # ---------------------------------------------
        # DECODE IMAGE
        # ---------------------------------------------

        buffer = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )

        image = cv2.imdecode(
            buffer,
            cv2.IMREAD_COLOR
        )

        if image is None:

            log(
                f"⚠️ OpenCV could not decode image: {image_path}"
            )

            return None

        # ---------------------------------------------
        # VALIDATE SIZE
        # ---------------------------------------------

        if image.size == 0:

            log(
                f"⚠️ Decoded image is empty: {image_path}"
            )

            return None

        height, width = image.shape[:2]

        if width <= 0 or height <= 0:

            log(
                f"⚠️ Invalid image dimensions: {image_path}"
            )

            return None

        log(
            f"✅ Image loaded: {os.path.basename(image_path)} "
            f"({width}x{height}, {file_size} bytes)"
        )

        return image

    except Exception as error:

        log(
            f"⚠️ Image read error: {image_path}"
        )

        log(
            f"   Error: {error}"
        )

        return None


# =====================================================
# IMAGE PREPARATION
# =====================================================

def prepare_image(image):

    if image is None or image.size == 0:
        return None

    try:

        if len(image.shape) == 2:

            image = cv2.cvtColor(
                image,
                cv2.COLOR_GRAY2BGR
            )

        # ---------------------------------------------
        # CLAHE LIGHTING ENHANCEMENT
        # ---------------------------------------------

        lab = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2LAB
        )

        l_channel, a_channel, b_channel = cv2.split(
            lab
        )

        clahe = cv2.createCLAHE(
            clipLimit=3.0,
            tileGridSize=(8, 8)
        )

        l_channel = clahe.apply(
            l_channel
        )

        enhanced_lab = cv2.merge(
            (
                l_channel,
                a_channel,
                b_channel
            )
        )

        enhanced = cv2.cvtColor(
            enhanced_lab,
            cv2.COLOR_LAB2BGR
        )

        return enhanced

    except Exception as error:

        log(
            f"Image enhancement error: {error}"
        )

        return image


# =====================================================
# DETECT FACE
# =====================================================

def detect_face(image):

    if image is None:
        return None

    try:

        height, width = image.shape[:2]

        if width <= 0 or height <= 0:
            return None

        # ---------------------------------------------
        # ORIGINAL IMAGE
        # ---------------------------------------------

        detector.setInputSize(
            (width, height)
        )

        _, faces = detector.detect(
            image
        )

        # ---------------------------------------------
        # ENHANCED IMAGE
        # ---------------------------------------------

        if faces is None or len(faces) == 0:

            enhanced = prepare_image(
                image
            )

            if enhanced is not None:

                eh, ew = enhanced.shape[:2]

                detector.setInputSize(
                    (ew, eh)
                )

                _, faces = detector.detect(
                    enhanced
                )

        if faces is None or len(faces) == 0:

            return None

        # ---------------------------------------------
        # VALID FACE FILTER
        # ---------------------------------------------

        valid_faces = []

        for face in faces:

            try:

                w = float(face[2])
                h = float(face[3])

                if w <= 0 or h <= 0:
                    continue

                if (
                    w * h
                    <
                    width * height * 0.0005
                ):
                    continue

                valid_faces.append(
                    face
                )

            except Exception:

                continue

        if not valid_faces:
            return None

        # ---------------------------------------------
        # LARGEST FACE
        # ---------------------------------------------

        largest_face = max(
            valid_faces,
            key=lambda f:
                float(f[2] * f[3])
        )

        return largest_face

    except Exception as error:

        log(
            f"Face detection error: {error}"
        )

        return None


# =====================================================
# EXTRACT FACE FEATURE
# =====================================================

def extract_feature(image):

    if image is None:
        return None

    try:

        working_image = image

        face = detect_face(
            image
        )

        # ---------------------------------------------
        # TRY ENHANCED IMAGE
        # ---------------------------------------------

        if face is None:

            enhanced = prepare_image(
                image
            )

            if enhanced is not None:

                face = detect_face(
                    enhanced
                )

                if face is not None:

                    working_image = enhanced

        if face is None:

            return None

        # ---------------------------------------------
        # FACE ALIGNMENT
        # ---------------------------------------------

        face = face.reshape(
            1,
            15
        )

        aligned_face = recognizer.alignCrop(
            working_image,
            face
        )

        if aligned_face is None:

            return None

        # ---------------------------------------------
        # FEATURE EXTRACTION
        # ---------------------------------------------

        feature = recognizer.feature(
            aligned_face
        )

        if feature is None:

            return None

        # ---------------------------------------------
        # NORMALIZE FEATURE
        # ---------------------------------------------

        feature = cv2.normalize(
            feature,
            None
        )

        return feature

    except Exception as error:

        log(
            f"Feature extraction error: {error}"
        )

        return None


# =====================================================
# READ NODE.JS INPUT
# =====================================================

try:

    input_text = sys.stdin.read()

    if not input_text.strip():

        send_result({
            "success": False,
            "message": "No input received"
        })

        sys.exit(1)

    data = json.loads(
        input_text
    )

except Exception as error:

    send_result({
        "success": False,
        "message": f"Invalid input data: {error}"
    })

    sys.exit(1)


# =====================================================
# GET QUERY PATH
# =====================================================

query_path = data.get(
    "queryPath"
)

candidates = data.get(
    "candidates",
    []
)


if not query_path:

    send_result({
        "success": False,
        "message": "Query photo path is missing"
    })

    sys.exit(1)


# =====================================================
# NORMALIZE QUERY PATH
# =====================================================

query_path = os.path.normpath(
    os.path.abspath(query_path)
)


log(
    "===================================="
)

log(
    "🔍 FACE SEARCH PYTHON"
)

log(
    "===================================="
)

log(
    f"📷 Query: {query_path}"
)

log(
    f"👤 Candidates: {len(candidates)}"
)


# =====================================================
# READ QUERY IMAGE
# =====================================================

query_image = read_image_safe(
    query_path
)


if query_image is None:

    send_result({
        "success": False,
        "message": "Unable to read uploaded photo",
        "path": query_path
    })

    sys.exit(1)


# =====================================================
# QUERY IMAGE SIZE
# =====================================================

try:

    q_height, q_width = query_image.shape[:2]

    log(
        f"📷 Query image size: "
        f"{q_width}x{q_height}"
    )

except Exception:

    pass


# =====================================================
# EXTRACT QUERY FEATURE
# =====================================================

query_feature = extract_feature(
    query_image
)


if query_feature is None:

    send_result({
        "success": True,
        "match": False,
        "score": 0,
        "criminal": None,
        "message": "No clear face detected in uploaded photo"
    })

    sys.exit(0)


log(
    "✅ Query face detected"
)


# =====================================================
# COMPARE CANDIDATES
# =====================================================

best_match = None
best_score = -1.0


for candidate in candidates:

    try:

        image_path = candidate.get(
            "imagePath"
        )

        if not image_path:

            continue

        image_path = os.path.normpath(
            os.path.abspath(image_path)
        )

        candidate_name = candidate.get(
            "name",
            "Unknown"
        )

        log(
            f"🔍 Checking: {candidate_name}"
        )

        # ---------------------------------------------
        # READ CANDIDATE
        # ---------------------------------------------

        candidate_image = read_image_safe(
            image_path
        )

        if candidate_image is None:

            log(
                f"⚠️ Skipping unreadable candidate: "
                f"{candidate_name}"
            )

            continue

        # ---------------------------------------------
        # EXTRACT CANDIDATE FEATURE
        # ---------------------------------------------

        candidate_feature = extract_feature(
            candidate_image
        )

        if candidate_feature is None:

            log(
                f"⚠️ No face in candidate: "
                f"{candidate_name}"
            )

            continue

        # ---------------------------------------------
        # COSINE SIMILARITY
        # ---------------------------------------------

        score = recognizer.match(
            query_feature,
            candidate_feature,
            cv2.FaceRecognizerSF_FR_COSINE
        )

        score = float(score)

        log(
            f"🎯 Candidate: {candidate_name} "
            f"| Score: {score:.4f}"
        )

        # ---------------------------------------------
        # BEST MATCH
        # ---------------------------------------------

        if score > best_score:

            best_score = score
            best_match = candidate

    except Exception as error:

        log(
            f"⚠️ Candidate processing error: "
            f"{error}"
        )

        continue


# =====================================================
# MATCH THRESHOLD
# =====================================================

MATCH_THRESHOLD = 0.363


log(
    "===================================="
)

log(
    f"🏆 BEST SCORE: {best_score:.4f}"
)

log(
    f"🎯 THRESHOLD: {MATCH_THRESHOLD}"
)


# =====================================================
# MATCH FOUND
# =====================================================

if (
    best_match is not None
    and best_score >= MATCH_THRESHOLD
):

    criminal = {

        "criminalId":
            best_match.get(
                "criminalId",
                ""
            ),

        "name":
            best_match.get(
                "name",
                ""
            ),

        "crime":
            best_match.get(
                "crime",
                ""
            ),

        "image":
            best_match.get(
                "image",
                ""
            ),

        "age":
            best_match.get(
                "age",
                ""
            ),

        "gender":
            best_match.get(
                "gender",
                ""
            ),

        "firNumber":
            best_match.get(
                "firNumber",
                ""
            ),

        "address":
            best_match.get(
                "address",
                ""
            ),

        "description":
            best_match.get(
                "description",
                ""
            )
    }

    log(
        "===================================="
    )

    log(
        "✅ FACE MATCH FOUND"
    )

    log(
        f"🆔 ID: {criminal['criminalId']}"
    )

    log(
        f"👤 Name: {criminal['name']}"
    )

    log(
        f"📊 Score: {best_score:.4f}"
    )

    log(
        "===================================="
    )

    send_result({

        "success": True,

        "match": True,

        "score": round(
            best_score,
            4
        ),

        "criminal": criminal,

        "message":
            "Face match found"
    })

    sys.exit(0)


# =====================================================
# NO MATCH
# =====================================================

log(
    "❌ NO MATCH FOUND"
)


send_result({

    "success": True,

    "match": False,

    "score": round(
        max(best_score, 0),
        4
    ),

    "criminal": None,

    "message":
        "No matching face found"
})


sys.exit(0)