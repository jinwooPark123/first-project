# backend/app.py
# -----------------------------
# Flask 기반 백엔드 애플리케이션
# 기능: React 프론트엔드로부터 텍스트를 받아 OpenAI 모델을 호출해 결과 반환
# -----------------------------

# Flask 관련 모듈 임포트
from flask import Flask, request, jsonify   # Flask 서버 생성, 요청/응답 처리용
from flask_cors import CORS                 # 프론트엔드(React)와의 CORS 통신 허용
from ai_handler import generate_text        # AI 텍스트 생성 함수 (별도 모듈)

# Flask 애플리케이션 인스턴스 생성
app = Flask(__name__)

# CORS 설정 (React에서 오는 요청 허용)
CORS(app)

# -----------------------------------
# [1] 테스트용 엔드포인트
# -----------------------------------
@app.route('/test', methods=['GET'])
def test():
    """
    연결 확인용 엔드포인트
    - 목적: 프론트엔드가 Flask 서버와 정상적으로 연결되었는지 테스트
    - 요청 방식: GET
    - 반환 값: 연결 상태를 나타내는 JSON 응답
    """
    return jsonify({"status": "Flask backend connected!"})

# -----------------------------------
# [2] AI 텍스트 생성 엔드포인트
# -----------------------------------
@app.route('/generate', methods=['POST'])
def generate():
    """
    핵심 엔드포인트: 사용자가 입력한 텍스트를 받아 AI에게 전달하고 결과 반환
    - 요청 방식: POST
    - 입력 데이터: {"text": "사용자 입력 내용"}
    - 처리 과정:
        1) JSON 데이터를 읽어 'text' 필드 추출
        2) 유효성 검사 (입력이 없으면 400 오류 반환)
        3) ai_handler.py의 generate_text() 호출 → AI 응답 생성
        4) 결과를 JSON 형태로 프론트엔드에 반환
    - 반환 데이터: {"response": "AI가 생성한 문장"}
    """
    data = request.get_json()                # 요청 본문(JSON) 파싱
    user_input = data.get("text", "")        # 입력 텍스트 추출 (없으면 빈 문자열)

    if not user_input:                       # 입력이 비어 있으면 오류 반환
        return jsonify({"error": "No input text provided"}), 400

    result = generate_text(user_input)       # AI 텍스트 생성 함수 호출
    return jsonify({"response": result})     # 결과를 JSON 형식으로 반환

# -----------------------------------
# [3] Flask 서버 실행
# -----------------------------------
if __name__ == '__main__':
    """
    Flask 개발 서버 실행 구문
    - debug=True : 코드 변경 시 자동 재시작, 오류 메시지 상세 표시
    - port=5000  : 로컬 서버 포트 설정
    """
    app.run(debug=True, port=5000)
