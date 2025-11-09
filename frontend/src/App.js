// frontend/src/App.js
// ------------------------------------------
// React 프론트엔드 메인 파일
// 기능: 사용자가 입력한 문장을 Flask 백엔드로 전송하고,
//       AI의 응답 결과를 화면에 표시함.
// ------------------------------------------

import React, { useState } from "react"; // React 훅(useState) 임포트
import axios from "axios"; // HTTP 요청용 라이브러리 (Flask 통신용)

function App() {
  // -----------------------------
  // [상태 변수 정의]
  // -----------------------------
  const [inputText, setInputText] = useState(""); // 사용자가 입력한 문장
  const [aiResponse, setAiResponse] = useState(""); // AI의 응답 결과
  const [loading, setLoading] = useState(false); // 로딩 상태 표시용

  // -----------------------------
  // [핵심 함수] Flask 서버 호출
  // -----------------------------
  const handleGenerate = async () => {
    // 입력값 검증: 공백 입력 방지
    if (!inputText.trim()) {
      alert("입력 내용을 작성해주세요.");
      return;
    }

    setLoading(true); // 로딩 상태 on
    try {
      // Flask 서버의 /generate 엔드포인트로 POST 요청 전송
      const response = await axios.post("http://127.0.0.1:5000/generate", {
        text: inputText, // JSON body에 "text" 필드로 전달
      });

      // Flask → AI 응답 결과를 상태에 저장
      setAiResponse(response.data.response);
    } catch (error) {
      console.error(error);
      setAiResponse("서버 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false); // 로딩 상태 off
    }
  };

  // -----------------------------
  // [UI 렌더링 영역]
  // -----------------------------
  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif" }}>
      <h2>AI 글쓰기 보조 도구</h2>

      {/* 사용자 입력 영역 */}
      <textarea
        rows="6"
        cols="70"
        placeholder="문장을 입력하세요..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)} // 입력값 실시간 반영
      />
      <br />

      {/* AI 호출 버튼 */}
      <button
        onClick={handleGenerate}
        style={{
          marginTop: "10px",
          padding: "8px 16px",
          backgroundColor: "#007BFF",
          color: "white",
          border: "none",
          borderRadius: "4px",
        }}
      >
        {loading ? "AI 생성 중..." : "AI 피드백 받기"}
      </button>

      {/* AI 응답 결과 표시 */}
      <div style={{ marginTop: "20px" }}>
        <h3>AI 응답</h3>
        <p>{aiResponse}</p>
      </div>
    </div>
  );
}

export default App;
