import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [hoverPreview, setHoverPreview] = useState("");
  const [highlightMode, setHighlightMode] = useState("자동 감지");
  const [suggestions, setSuggestions] = useState("");
  const [streamSuggestion, setStreamSuggestion] = useState("");
  const [isSuggestStreaming, setIsSuggestStreaming] = useState(false);
  const [errorDetection, setErrorDetection] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [suggestionItems, setSuggestionItems] = useState([]); // 실시간 제안 개별 항목 배열
  const [batchSuggestionItems, setBatchSuggestionItems] = useState([]); // 일괄 제안 개별 항목 배열
  const suggestionRef = useRef(null);
  const textareaRef = useRef(null);

  // ============================================================
  // 1️⃣ 실시간 예측 (AI Cursor)
  // ============================================================
  const handleStream = async () => {
    if (window.currentEventSource) {
      window.currentEventSource.close();
      window.currentEventSource = null;
    }

    setStreamText("");

    try {
      await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      const eventSource = new EventSource("http://localhost:5000/stream-events");

      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          eventSource.close();
          window.currentEventSource = null;
          return;
        }
        setStreamText((prev) => prev + data);
      };

      eventSource.onerror = (err) => {
        console.error("SSE error:", err);
        setStreamText((prev) => prev + "\n\n[스트리밍 오류]");
        eventSource.close();
        window.currentEventSource = null;
      };

      window.currentEventSource = eventSource;
    } catch (err) {
      console.error("Stream error:", err);
      setStreamText("연결 오류 발생: " + err.message);
    }
  };

  // ============================================================
  // 2️⃣ 문장 제안 (일괄 응답)
  // ============================================================
  const handleSuggest = async () => {
    try {
      const res = await fetch("http://localhost:5000/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });
      const data = await res.json();
      const suggestionsText = data.suggestions || "";
      setSuggestions(suggestionsText);
      // 일괄 제안도 파싱하여 개별 항목으로 변환
      parseBatchSuggestions(suggestionsText);
    } catch (err) {
      console.error("Suggest error:", err);
    }
  };

  // ============================================================
  // 3️⃣ 실시간 문장 제안 (SSE)
  // ============================================================
  const handleSuggestStream = async () => {
    if (window.currentEventSource) {
      window.currentEventSource.close();
      window.currentEventSource = null;
    }

    setStreamSuggestion("");
    setIsSuggestStreaming(true);

    try {
      await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      const eventSource = new EventSource("http://localhost:5000/suggest-stream");

      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          setIsSuggestStreaming(false);
          eventSource.close();
          window.currentEventSource = null;
          return;
        }
        setStreamSuggestion((prev) => {
          const newText = prev + data;
          return newText;
        });
      };

      eventSource.onerror = (err) => {
        console.error("Suggest Stream SSE error:", err);
        setStreamSuggestion((prev) => prev + "\n\n[스트리밍 오류]");
        setIsSuggestStreaming(false);
        eventSource.close();
        window.currentEventSource = null;
      };

      window.currentEventSource = eventSource;
    } catch (err) {
      console.error("Suggest Stream error:", err);
      setStreamSuggestion("연결 오류 발생: " + err.message);
      setIsSuggestStreaming(false);
    }
  };

  // ============================================================
  // 4️⃣ 오타·문법 탐지
  // ============================================================
  const handleDetectErrors = async () => {
    setIsDetecting(true);
    setErrorDetection(null);
    try {
      const res = await fetch("http://localhost:5000/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });
      const data = await res.json();
      setErrorDetection(data);
    } catch (err) {
      console.error("Detect error:", err);
      setErrorDetection({ error: "탐지 중 오류 발생: " + err.message });
    } finally {
      setIsDetecting(false);
    }
  };

  // ============================================================
  // 5️⃣ Hover 미리보기
  // ============================================================
  const handleHover = (type) => {
    const previews = {
      감성적: "따뜻하고 공감형 문체 예시",
      논리적: "논거와 분석 중심 문체 예시",
      설명적: "정보를 풀어주는 서술형 문체 예시",
      서사적: "이야기 흐름 중심 문체 예시",
      "자동 감지": "AI가 문체를 자동으로 판단합니다",
    };
    setHoverPreview(previews[type]);
  };

  // ============================================================
  // 6️⃣ 제안 문장 파싱 (개별 항목으로 분리)
  // ============================================================
  const parseSuggestions = useCallback((text) => {
    if (!text || !text.trim()) {
      setSuggestionItems([]);
      return;
    }

    const lines = text.split("\n").filter((line) => line.trim());
    const items = [];

    lines.forEach((line, idx) => {
      let trimmed = line.trim();
      // 실시간 제안은 번호를 제거하고 하나의 문장만 표시
      // 번호가 있는 경우 제거 (1., 2., 3. 등)
      const numberedMatch = /^(\d+\.\s*)(.+)/.exec(trimmed);
      if (numberedMatch) {
        // 번호 제거
        trimmed = numberedMatch[2].trim();
      }
      
      // 의미있는 문장인 경우에만 추가
      if (trimmed && trimmed.length > 0) {
        items.push({
          id: idx,
          number: "", // 실시간 제안은 번호 없음
          text: trimmed,
          fullText: trimmed,
        });
      }
    });

    setSuggestionItems(items);
  }, []);

  // ============================================================
  // 7️⃣ 제안 채택 핸들러
  // ============================================================
  const handleAcceptSuggestion = (suggestionText) => {
    setInput((prev) => {
      // 입력이 비어있으면 그대로 추가, 있으면 공백 후 추가
      return prev.trim() ? prev + " " + suggestionText : suggestionText;
    });
    // 채택된 제안은 목록에서 제거하지 않고 유지 (사용자가 여러 개 선택 가능)
  };

  // ============================================================
  // 8️⃣ 제안 거부 핸들러
  // ============================================================
  const handleRejectSuggestion = (suggestionId) => {
    setSuggestionItems((prev) => prev.filter((item) => item.id !== suggestionId));
  };

  // ============================================================
  // 8-1️⃣ 일괄 제안 문장 파싱 (개별 항목으로 분리)
  // ============================================================
  const parseBatchSuggestions = useCallback((text) => {
    if (!text || !text.trim()) {
      setBatchSuggestionItems([]);
      return;
    }

    const lines = text.split("\n").filter((line) => line.trim());
    const items = [];
    let currentItem = null;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      // 번호가 있는 제안 (1., 2., 3. 등)
      const numberedMatch = /^(\d+\.\s*)(.+)/.exec(trimmed);
      if (numberedMatch) {
        // 이전 항목이 있으면 저장
        if (currentItem) {
          items.push(currentItem);
        }
        // 새 항목 시작
        currentItem = {
          id: idx,
          number: numberedMatch[1],
          text: numberedMatch[2].trim(),
          explanation: "",
          fullText: trimmed,
        };
      } else if (trimmed.startsWith("설명:") || trimmed.startsWith("설명 :")) {
        // 설명 부분
        if (currentItem) {
          currentItem.explanation = trimmed.replace(/^설명:?\s*/, "").trim();
        }
      } else if (trimmed && !trimmed.match(/^[^\w가-힣]/) && currentItem) {
        // 설명이 여러 줄일 수 있음
        if (currentItem.explanation) {
          currentItem.explanation += " " + trimmed;
        } else {
          currentItem.text += " " + trimmed;
        }
      } else if (trimmed && !trimmed.match(/^[^\w가-힣]/) && !currentItem) {
        // 번호가 없지만 의미있는 문장인 경우
        items.push({
          id: idx,
          number: "",
          text: trimmed,
          explanation: "",
          fullText: trimmed,
        });
      }
    });

    // 마지막 항목 추가
    if (currentItem) {
      items.push(currentItem);
    }

    setBatchSuggestionItems(items);
  }, []);

  // ============================================================
  // 8-2️⃣ 일괄 제안 거부 핸들러
  // ============================================================
  const handleRejectBatchSuggestion = (suggestionId) => {
    setBatchSuggestionItems((prev) => prev.filter((item) => item.id !== suggestionId));
  };

  // ============================================================
  // 9️⃣ 제안 스트리밍 완료 시 파싱
  // ============================================================
  useEffect(() => {
    if (!isSuggestStreaming && streamSuggestion) {
      parseSuggestions(streamSuggestion);
    }
  }, [isSuggestStreaming, streamSuggestion, parseSuggestions]);

  // ============================================================
  // 🔟 단축키 핸들러 (Enter: 첫 번째 제안 채택, Esc: 모든 제안 거절)
  // ============================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      // textarea가 포커스되어 있으면 단축키 비활성화
      if (document.activeElement === textareaRef.current) {
        return;
      }

      // Enter: 첫 번째 제안 문장 채택
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (suggestionItems.length > 0) {
          handleAcceptSuggestion(suggestionItems[0].text);
        }
      }
      // Esc: 모든 제안 거절
      if (e.key === "Escape") {
        setStreamSuggestion("");
        setSuggestionItems([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [suggestionItems]);

  // ============================================================
  // JSX 렌더링 - 2패널 레이아웃
  // ============================================================
  return (
    <div className="App">
      <h2>문맥필 / 글잇다 v2.4 — 사고 확장형 문맥 보조 시스템</h2>

      <div className="main-container">
        {/* 좌측 패널: 작성 공간 */}
        <div className="left-panel">
          <div className="input-section">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="문장을 입력하세요..."
            />

            <div className="btn-group">
              <button onClick={handleStream}>실시간 예측 ✍️</button>
              <button onClick={handleSuggest}>문장 제안 💡(일괄)</button>
              <button onClick={handleSuggestStream}>실시간 제안 💡</button>
              <button onClick={handleDetectErrors} disabled={isDetecting}>
                {isDetecting ? "탐지 중..." : "오타·문법 탐지 🔍"}
              </button>
            </div>

            <div className="highlight-mode">
              <span>문체 모드:</span>
              {["감성적", "논리적", "설명적", "서사적", "자동 감지"].map((mode) => (
                <button
                  key={mode}
                  className={highlightMode === mode ? "active" : ""}
                  onMouseEnter={() => handleHover(mode)}
                  onMouseLeave={() => setHoverPreview("")}
                  onClick={() => setHighlightMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>

            {hoverPreview && <div className="hover-preview">{hoverPreview}</div>}

            <div className="output-section">
              <div className="ai-cursor">
                <h3>AI Cursor ✍️</h3>
                <p>{streamText}</p>
              </div>

              {/* 문장 제안 (일괄) - Cursor AI 스타일 */}
              {(batchSuggestionItems.length > 0 || suggestions) && (
                <div className="ai-suggestions">
                  <h3>문장 제안 💡 (일괄)</h3>
                  {batchSuggestionItems.length > 0 ? (
                    <div className="suggestion-content">
                      {batchSuggestionItems.map((item) => (
                        <div key={item.id} className="suggestion-item-cursor">
                          <div className="suggestion-item-content">
                            {item.number && (
                              <span className="suggestion-number">{item.number}</span>
                            )}
                            <div className="suggestion-text-wrapper">
                              <span className="suggestion-text">{item.text}</span>
                              {item.explanation && (
                                <div className="suggestion-explanation">
                                  <strong>설명:</strong> {item.explanation}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="suggestion-actions">
                            <button
                              className="accept-btn"
                              onClick={() => handleAcceptSuggestion(item.text)}
                              title="채택"
                            >
                              ✓ 채택
                            </button>
                            <button
                              className="reject-btn"
                              onClick={() => handleRejectBatchSuggestion(item.id)}
                              title="거절"
                            >
                              ✕ 거절
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="suggestion-raw-text">{suggestions}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측 패널: 기능 공간 */}
        <div className="right-panel">
          <div className="function-section">
            {/* 실시간 문장 제안 (SSE) - Cursor AI 스타일 */}
            <div className="ai-suggestions-stream" ref={suggestionRef}>
              <h3>실시간 제안 💡</h3>
              <div className="shortcut-hint">
                Enter: 첫 번째 채택 | Esc: 모두 거절
              </div>
              {isSuggestStreaming ? (
                <p className="loading">AI가 실시간 제안 중...</p>
              ) : suggestionItems.length > 0 ? (
                <div className="suggestion-content">
                  {suggestionItems.map((item) => (
                    <div key={item.id} className="suggestion-item-cursor">
                      <div className="suggestion-item-content">
                        {/* 실시간 제안은 번호 없이 하나의 완성된 문장만 표시 */}
                        <span className="suggestion-text">{item.text}</span>
                      </div>
                      <div className="suggestion-actions">
                        <button
                          className="accept-btn"
                          onClick={() => handleAcceptSuggestion(item.text)}
                          title="채택 (Enter)"
                        >
                          ✓ 채택
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => handleRejectSuggestion(item.id)}
                          title="거절"
                        >
                          ✕ 거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : streamSuggestion ? (
                <div className="suggestion-content">
                  <p className="suggestion-raw-text">{streamSuggestion}</p>
                </div>
              ) : (
                <p className="empty-state">제안 문장이 여기에 표시됩니다</p>
              )}
            </div>

            {/* 오타·문법 탐지 결과 */}
            {errorDetection && (
              <div className="ai-error-detection">
                <h3>오타·문법 탐지 🔍</h3>
                {errorDetection.error ? (
                  <p className="error-message">{errorDetection.error}</p>
                ) : errorDetection.errors && errorDetection.errors.length > 0 ? (
                  <div className="error-list">
                    {errorDetection.errors.map((err, idx) => (
                      <div key={idx} className="error-item">
                        <div className="error-original">
                          <strong>원본:</strong> {err.original}
                        </div>
                        <div className="error-corrected">
                          <strong>수정:</strong> <span className="corrected-text">{err.corrected}</span>
                        </div>
                        <div className="error-type">
                          <strong>유형:</strong> {err.type || "오류"}
                        </div>
                        {err.reason && (
                          <div className="error-reason">
                            <strong>이유:</strong> {err.reason}
                          </div>
                        )}
                        <hr className="error-divider" />
                      </div>
                    ))}
                    {errorDetection.summary && (
                      <div className="error-summary">
                        <strong>요약:</strong> {errorDetection.summary}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="no-errors">오류가 발견되지 않았습니다. ✅</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
