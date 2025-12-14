import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { supabase } from './supabaseClient';

function App() {
  // 디버깅: 컴포넌트가 마운트되었는지 확인
  useEffect(() => {
    console.log("App 컴포넌트가 마운트되었습니다.");
    
    // 백엔드 서버 연결 상태 확인
    const checkBackendConnection = async () => {
      try {
        const response = await fetch("http://localhost:5000/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "", tone: "자동 감지" }),
        });
        if (response.ok) {
          console.log("✅ 백엔드 서버 연결 성공");
        }
      } catch (err) {
        console.warn("⚠️ 백엔드 서버 연결 실패:", err.message);
        console.warn("백엔드 서버가 실행 중인지 확인하세요: start_backend.bat 실행");
      }
    };
    
    // 2초 후 백엔드 연결 확인 (서버 시작 시간 고려)
    setTimeout(checkBackendConnection, 2000);
  }, []);

  // Supabase 인증 상태 확인
  useEffect(() => {
    if (!supabase) {
      console.warn("Supabase 클라이언트가 없어 인증 상태를 확인할 수 없습니다.");
      console.warn("환경 변수를 확인하세요: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY");
      return;
    }

    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          // 이전 사용자 데이터 초기화
          setInput("");
          setSavedTexts([]);
          setShowHistory(false);
          setStreamText("");
          setSuggestions("");
          setStreamSuggestion("");
          setSuggestionItems([]);
          setBatchSuggestionItems([]);
          setErrorDetection(null);
          setSummaryText("");
          setPolishedText("");
          setSpacingText("");
        }
        setUser(session?.user ?? null);
      }).catch((err) => {
        console.error("세션 가져오기 오류:", err);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          // 로그인 시 이전 사용자 데이터 초기화
          setInput("");
          setSavedTexts([]);
          setShowHistory(false);
          setStreamText("");
          setSuggestions("");
          setStreamSuggestion("");
          setSuggestionItems([]);
          setBatchSuggestionItems([]);
          setErrorDetection(null);
          setSummaryText("");
          setPolishedText("");
          setSpacingText("");
          console.log("새 사용자 로그인:", session.user.id, session.user.email || session.user.user_metadata?.username);
        } else {
          // 로그아웃 시 모든 상태 초기화
          setInput("");
          setSavedTexts([]);
          setShowHistory(false);
          setStreamText("");
          setSuggestions("");
          setStreamSuggestion("");
          setSuggestionItems([]);
          setBatchSuggestionItems([]);
          setErrorDetection(null);
          setSummaryText("");
          setPolishedText("");
          setSpacingText("");
        }
        setUser(session?.user ?? null);
      });

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    } catch (err) {
      console.error("인증 상태 확인 오류:", err);
    }
  }, []);

  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [hoverPreview, setHoverPreview] = useState("");
  const [highlightMode, setHighlightMode] = useState("자동 감지");
  const [suggestions, setSuggestions] = useState("");
  const [streamSuggestion, setStreamSuggestion] = useState("");
  const [isSuggestStreaming, setIsSuggestStreaming] = useState(false);
  const [errorDetection, setErrorDetection] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [polishedText, setPolishedText] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);
  const [spacingText, setSpacingText] = useState("");
  const [isCorrectingSpacing, setIsCorrectingSpacing] = useState(false);
  const [acceptDropdownOpen, setAcceptDropdownOpen] = useState(null); // 드롭다운 열림 상태 (item.id 또는 'stream' 등)
  const [loginError, setLoginError] = useState(""); // 로그인 에러 메시지
  const [showSignUpModal, setShowSignUpModal] = useState(false); // 회원가입 모달 표시 여부
  const [signUpError, setSignUpError] = useState(""); // 회원가입 에러 메시지
  const [signUpSuccess, setSignUpSuccess] = useState(false); // 회원가입 성공 여부
  const [suggestionItems, setSuggestionItems] = useState([]); // 실시간 제안 개별 항목 배열
  const [batchSuggestionItems, setBatchSuggestionItems] = useState([]); // 일괄 제안 개별 항목 배열
  const [charCount, setCharCount] = useState(0); // 글자 수 카운터
  const [wordCount, setWordCount] = useState(0); // 단어 수 카운터
  const [isStreaming, setIsStreaming] = useState(false); // 실시간 예측 스트리밍 상태
  const [toastMessage, setToastMessage] = useState(""); // 토스트 메시지
  const [user, setUser] = useState(null); // Supabase 사용자
  // eslint-disable-next-line no-unused-vars
  const [session, setSession] = useState(null); // Supabase 세션
  const [savedTexts, setSavedTexts] = useState([]); // 저장된 텍스트 목록
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // 히스토리 로딩 상태
  const [showHistory, setShowHistory] = useState(false); // 히스토리 표시 여부
  const [activeTab, setActiveTab] = useState("작성"); // 탭 상태: "작성", "설정"
  const [accordionStates, setAccordionStates] = useState({
    writing: true,      // 작성 영역
    aiFeatures: true,    // AI 기능
    utility: true,      // 유틸리티
    toneMode: true,    // 문체 모드
    savedTexts: false, // 저장된 텍스트
    stream: false,     // 실시간 예측
    suggestStream: false, // 실시간 제안
    suggest: false,    // 일괄 제안
    error: false,      // 오타 탐지
    summary: false,     // 요약
    polish: false,      // 텍스트 다듬기
    spacing: false      // 띄어쓰기 교정
  });
  const suggestionRef = useRef(null);
  const textareaRef = useRef(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (acceptDropdownOpen && !event.target.closest('.accept-dropdown-wrapper')) {
        setAcceptDropdownOpen(null);
      }
    };

    if (acceptDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [acceptDropdownOpen]);

  // 아코디언 토글 함수
  const toggleAccordion = (key) => {
    setAccordionStates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // AI 결과 섹션 닫기 함수
  const closeAiResult = (resultType) => {
    switch(resultType) {
      case 'suggestStream':
        setStreamSuggestion("");
        setSuggestionItems([]);
        setIsSuggestStreaming(false);
        setAccordionStates(prev => ({ ...prev, suggestStream: false }));
        break;
      case 'stream':
        setStreamText("");
        setIsStreaming(false);
        setAccordionStates(prev => ({ ...prev, stream: false }));
        closeEventSource();
        break;
      case 'suggest':
        setSuggestions("");
        setBatchSuggestionItems([]);
        setAccordionStates(prev => ({ ...prev, suggest: false }));
        break;
      case 'error':
        setErrorDetection(null);
        setIsDetecting(false);
        setAccordionStates(prev => ({ ...prev, error: false }));
        break;
      case 'summary':
        setSummaryText("");
        setIsSummarizing(false);
        setAccordionStates(prev => ({ ...prev, summary: false }));
        break;
      case 'polish':
        setPolishedText("");
        setIsPolishing(false);
        setAccordionStates(prev => ({ ...prev, polish: false }));
        break;
      case 'spacing':
        setSpacingText("");
        setIsCorrectingSpacing(false);
        setAccordionStates(prev => ({ ...prev, spacing: false }));
        break;
      default:
        break;
    }
  };

  // 토스트 메시지 표시 함수
  const showToast = useCallback((message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3000);
  }, []);

  // EventSource 정리 함수
  const closeEventSource = useCallback(() => {
    if (window.currentEventSource) {
      window.currentEventSource.close();
      window.currentEventSource = null;
    }
  }, []);

  // 공통 API 호출 함수
  const sendToBackend = useCallback(async (endpoint, data = {}) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

      const res = await fetch(`http://localhost:5000/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode, ...data }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${res.status} 오류`);
      }

      return await res.json();
    } catch (err) {
      console.error(`API error (${endpoint}):`, err);
      if (err.name === 'AbortError') {
        throw new Error("요청 시간이 초과되었습니다. 다시 시도해주세요.");
      }
      // 네트워크 오류 처리
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('가져오지 못했습니다')) {
        throw new Error("백엔드 서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:5000)");
      }
      throw err;
    }
  }, [input, highlightMode]);

  // ============================================================
  // 0️⃣ 글자 수 및 단어 수 계산
  // ============================================================
  useEffect(() => {
    const text = input.trim();
    setCharCount(text.length);
    setWordCount(text ? text.split(/\s+/).filter(word => word.length > 0).length : 0);
  }, [input]);

  // ============================================================
  // 1️⃣ 실시간 예측
  // ============================================================
  const handleStream = useCallback(async () => {
    // 입력 검증
    if (!input.trim()) {
      showToast("⚠️ 문장을 입력한 후 예측을 요청해주세요.");
      return;
    }

    setAccordionStates(prev => ({ ...prev, stream: true }));
    closeEventSource();
    setStreamText("");
    setIsStreaming(true);

    try {
      const response = await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const eventSource = new EventSource("http://localhost:5000/stream-events");

      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          setIsStreaming(false);
          closeEventSource();
          return;
        }
        // 에러 메시지 처리
        if (data.startsWith("[ERROR]")) {
          setIsStreaming(false);
          showToast("❌ " + data.replace("[ERROR]", "").trim());
          closeEventSource();
          return;
        }
        setStreamText((prev) => prev + data);
      };

      eventSource.onerror = (err) => {
        console.error("SSE error:", err);
        setStreamText((prev) => prev + "\n\n[스트리밍 연결이 끊어졌습니다]");
        setIsStreaming(false);
        showToast("❌ 스트리밍 연결 오류가 발생했습니다.");
        closeEventSource();
      };

      window.currentEventSource = eventSource;
    } catch (err) {
      console.error("Stream error:", err);
      const errorMsg = err.message.includes('Failed to fetch') || err.message.includes('NetworkError')
        ? "백엔드 서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:5000)"
        : err.message;
      setStreamText("연결 오류 발생: " + errorMsg);
      setIsStreaming(false);
      showToast("❌ 서버 연결 오류가 발생했습니다: " + errorMsg);
    }
  }, [input, highlightMode, closeEventSource, showToast]);

  // ============================================================
  // 1-1️⃣ 일괄 제안 문장 파싱 (개별 항목으로 분리) - handleSuggest보다 먼저 정의
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
  // 2️⃣ 문장 제안 (일괄 응답)
  // ============================================================
  const handleSuggest = useCallback(async () => {
    // 입력 검증
    if (!input.trim()) {
      showToast("⚠️ 문장을 입력한 후 제안을 요청해주세요.");
      return;
    }

    setAccordionStates(prev => ({ ...prev, suggest: true }));
    try {
      const data = await sendToBackend("suggest");
      
      // 에러 응답 처리
      if (data.error) {
        showToast(`❌ ${data.error}`);
        setSuggestions("");
        setBatchSuggestionItems([]);
        return;
      }

      const suggestionsText = data.suggestions || "";
      setSuggestions(suggestionsText);
      parseBatchSuggestions(suggestionsText);
    } catch (err) {
      console.error("Suggest error:", err);
      showToast("❌ 문장 제안 중 오류가 발생했습니다: " + (err.message || "알 수 없는 오류"));
      setSuggestions("");
      setBatchSuggestionItems([]);
    }
  }, [input, sendToBackend, parseBatchSuggestions, showToast]);

  // ============================================================
  // 3️⃣ 실시간 문장 제안 (SSE)
  // ============================================================
  const handleSuggestStream = useCallback(async () => {
    // 입력 검증
    if (!input.trim()) {
      showToast("⚠️ 문장을 입력한 후 제안을 요청해주세요.");
      return;
    }

    setAccordionStates(prev => ({ ...prev, suggestStream: true }));
    closeEventSource();
    setStreamSuggestion("");
    setIsSuggestStreaming(true);

    try {
      const response = await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const eventSource = new EventSource("http://localhost:5000/suggest-stream");

      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          setIsSuggestStreaming(false);
          closeEventSource();
          return;
        }
        // 에러 메시지 처리
        if (data.startsWith("[ERROR]")) {
          setIsSuggestStreaming(false);
          showToast("❌ " + data.replace("[ERROR]", "").trim());
          closeEventSource();
          return;
        }
        setStreamSuggestion((prev) => prev + data);
      };

      eventSource.onerror = (err) => {
        console.error("Suggest Stream SSE error:", err);
        setStreamSuggestion((prev) => prev + "\n\n[스트리밍 연결이 끊어졌습니다]");
        setIsSuggestStreaming(false);
        showToast("❌ 실시간 제안 스트리밍 오류가 발생했습니다.");
        closeEventSource();
      };

      window.currentEventSource = eventSource;
    } catch (err) {
      console.error("Suggest Stream error:", err);
      const errorMsg = err.message.includes('Failed to fetch') || err.message.includes('NetworkError')
        ? "백엔드 서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:5000)"
        : err.message;
      setStreamSuggestion("연결 오류 발생: " + errorMsg);
      setIsSuggestStreaming(false);
      showToast("❌ 서버 연결 오류가 발생했습니다: " + errorMsg);
    }
  }, [input, highlightMode, closeEventSource, showToast]);

  // ============================================================
  // 4️⃣ 오타·문법 탐지
  // ============================================================
  const handleDetectErrors = useCallback(async () => {
    // 입력 검증
    if (!input.trim()) {
      showToast("⚠️ 문장을 입력한 후 탐지를 요청해주세요.");
      return;
    }

    setAccordionStates(prev => ({ ...prev, error: true }));
    setIsDetecting(true);
    setErrorDetection(null);
    try {
      const data = await sendToBackend("detect");
      
      // 에러 응답 처리
      if (data.error && !data.errors) {
        showToast(`❌ ${data.error}`);
        setErrorDetection({ error: data.error, errors: [], summary: "" });
        return;
      }

      setErrorDetection(data);
    } catch (err) {
      console.error("Detect error:", err);
      const errorMessage = err.message || "알 수 없는 오류";
      setErrorDetection({ error: "탐지 중 오류 발생: " + errorMessage, errors: [], summary: "" });
      showToast("❌ 오타·문법 탐지 중 오류가 발생했습니다: " + errorMessage);
    } finally {
      setIsDetecting(false);
    }
  }, [input, sendToBackend, showToast]);

  // ============================================================
  // 5️⃣ 텍스트 요약 기능
  // ============================================================
  const handleSummarize = useCallback(async () => {
    // 입력 검증
    if (!input.trim()) {
      showToast("⚠️ 요약할 텍스트를 입력해주세요.");
      return;
    }

    setAccordionStates(prev => ({ ...prev, summary: true }));
    setIsSummarizing(true);
    setSummaryText("");
    try {
      const response = await fetch("http://localhost:5000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          tone: highlightMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        showToast(`❌ ${data.error}`);
        setSummaryText("");
        return;
      }

      if (data.summary) {
        setSummaryText(data.summary);
        showToast("✅ 요약이 완료되었습니다.");
      } else {
        showToast("⚠️ 요약 결과가 없습니다.");
      }
    } catch (err) {
      console.error("Summarize error:", err);
      const errorMessage = err.message || "알 수 없는 오류";
      showToast("❌ 요약 중 오류가 발생했습니다: " + errorMessage);
      setSummaryText("");
    } finally {
      setIsSummarizing(false);
    }
  }, [input, highlightMode, showToast]);

  // ============================================================
  // 6️⃣ 텍스트 다듬기 기능
  // ============================================================
  const handlePolish = useCallback(async () => {
    // 입력 검증
    if (!input.trim()) {
      showToast("⚠️ 다듬을 텍스트를 입력해주세요.");
      return;
    }

    setAccordionStates(prev => ({ ...prev, polish: true }));
    setIsPolishing(true);
    setPolishedText("");
    try {
      const response = await fetch("http://localhost:5000/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          tone: highlightMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        showToast(`❌ ${data.error}`);
        setPolishedText("");
        return;
      }

      if (data.polished) {
        setPolishedText(data.polished);
        showToast("✅ 텍스트 다듬기가 완료되었습니다.");
      } else {
        showToast("⚠️ 다듬기 결과가 없습니다.");
      }
    } catch (err) {
      console.error("Polish error:", err);
      const errorMessage = err.message || "알 수 없는 오류";
      showToast("❌ 텍스트 다듬기 중 오류가 발생했습니다: " + errorMessage);
      setPolishedText("");
    } finally {
      setIsPolishing(false);
    }
  }, [input, highlightMode, showToast]);

  // ============================================================
  // 7️⃣ 띄어쓰기 교정 기능
  // ============================================================
  const handleCorrectSpacing = useCallback(async () => {
    // 입력 검증
    if (!input.trim()) {
      showToast("⚠️ 교정할 텍스트를 입력해주세요.");
      return;
    }

    setAccordionStates(prev => ({ ...prev, spacing: true }));
    setIsCorrectingSpacing(true);
    setSpacingText("");
    try {
      const response = await fetch("http://localhost:5000/correct-spacing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          tone: highlightMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        showToast(`❌ ${data.error}`);
        setSpacingText("");
        return;
      }

      if (data.corrected_text) {
        setSpacingText(data.corrected_text);
        showToast("✅ 띄어쓰기 교정이 완료되었습니다.");
      } else {
        showToast("⚠️ 교정 결과가 없습니다.");
      }
    } catch (err) {
      console.error("Correct spacing error:", err);
      const errorMessage = err.message || "알 수 없는 오류";
      showToast("❌ 띄어쓰기 교정 중 오류가 발생했습니다: " + errorMessage);
      setSpacingText("");
    } finally {
      setIsCorrectingSpacing(false);
    }
  }, [input, highlightMode, showToast]);

  // ============================================================
  // 8️⃣ Hover 미리보기
  // ============================================================
  const handleHover = useCallback((type) => {
    const previews = {
      감성적: "따뜻하고 공감형 문체 예시",
      논리적: "논거와 분석 중심 문체 예시",
      설명적: "정보를 풀어주는 서술형 문체 예시",
      서사적: "이야기 흐름 중심 문체 예시",
      "자동 감지": "AI가 문체를 자동으로 판단합니다",
    };
    setHoverPreview(previews[type]);
  }, []);

  // ============================================================
  // 8️⃣ 제안 문장 파싱 (개별 항목으로 분리)
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
  // 채택 옵션: 이어쓰기
  const handleAcceptSuggestionAppend = useCallback((suggestionText) => {
    // 괄호 안의 설명 부분 제거 (예: "(방문 목적을 외교 전략의 일환으로 강조함)")
    // 한글/영문 괄호 모두 처리
    const cleanedText = suggestionText
      .replace(/\s*\([^)]*\)\s*/g, '') // 일반 괄호 제거
      .replace(/\s*（[^）]*）\s*/g, '') // 전각 괄호 제거
      .trim();
    
    setInput((prev) => {
      // 입력이 비어있으면 그대로 추가, 있으면 공백 후 추가
      return prev.trim() ? prev + " " + cleanedText : cleanedText;
    });
    setAcceptDropdownOpen(null);
    showToast("✅ 문장이 이어서 추가되었습니다.");
  }, [showToast]);

  // 채택 옵션: 교체
  const handleAcceptSuggestionReplace = useCallback((suggestionText) => {
    // 괄호 안의 설명 부분 제거
    const cleanedText = suggestionText
      .replace(/\s*\([^)]*\)\s*/g, '') // 일반 괄호 제거
      .replace(/\s*（[^）]*）\s*/g, '') // 전각 괄호 제거
      .trim();
    
    setInput(cleanedText);
    setAcceptDropdownOpen(null);
    showToast("✅ 문장이 교체되었습니다.");
  }, [showToast]);

  // 기존 함수는 이어쓰기로 유지 (하위 호환성)
  const handleAcceptSuggestion = handleAcceptSuggestionAppend;

  // ============================================================
  // 7-1️⃣ 오타 수정 채택 핸들러
  // ============================================================
  const handleAcceptErrorCorrection = useCallback((original, corrected) => {
    setInput((prev) => {
      // 원본 텍스트를 수정된 텍스트로 교체
      if (prev.includes(original)) {
        return prev.replace(original, corrected);
      }
      return prev;
    });
    showToast("✅ 수정이 적용되었습니다!");
  }, [showToast]);

  // ============================================================
  // 7-2️⃣ 오타 수정 거절 핸들러
  // ============================================================
  const handleRejectErrorCorrection = useCallback((errorIndex) => {
    if (errorDetection && errorDetection.errors) {
      const updatedErrors = errorDetection.errors.filter((_, idx) => idx !== errorIndex);
      setErrorDetection({
        ...errorDetection,
        errors: updatedErrors,
        summary: `요약: ${updatedErrors.length}개의 오류가 발견되었습니다.`
      });
      showToast("✅ 수정 제안이 제거되었습니다.");
    }
  }, [errorDetection, showToast]);

  // ============================================================
  // 8️⃣ 제안 거부 핸들러
  // ============================================================
  const handleRejectSuggestion = (suggestionId) => {
    setSuggestionItems((prev) => prev.filter((item) => item.id !== suggestionId));
  };

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
  }, [suggestionItems, handleAcceptSuggestion]);

  // 컴포넌트 언마운트 시 EventSource 정리
  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, [closeEventSource]);

  // ============================================================
  // 로그인 함수 (이메일 또는 아이디 지원)
  // ============================================================
  const handleLogin = async (identifier, password) => {
    // 에러 메시지 초기화
    setLoginError("");
    
    // Supabase 클라이언트 확인
    if (!supabase) {
      showToast("❌ Supabase가 초기화되지 않았습니다. 환경 변수를 확인하세요.");
      console.error("Supabase 클라이언트가 없습니다.");
      return;
    }

    // 입력 검증 추가
    if (!identifier || !identifier.trim()) {
      showToast("⚠️ 아이디 또는 이메일을 입력해주세요.");
      console.error("아이디/이메일이 비어있습니다.");
      return;
    }
    
    if (!password || password.length < 6) {
      showToast("⚠️ 비밀번호를 입력해주세요.");
      console.error("비밀번호가 비어있습니다.");
      return;
    }

    // 아이디/이메일 처리: @가 없으면 아이디로 간주하여 @temp.local 추가
    let email = identifier.trim();
    if (!email.includes('@')) {
      email = `${email}@temp.local`;
    }

    try {
      console.log("로그인 시도:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      console.log("로그인 응답:", { data, error });
      
      if (error) {
        console.error("로그인 에러:", error);
        throw error;
      }
      
      if (data?.user) {
        // 이전 사용자의 데이터 초기화
        setInput("");
        setSavedTexts([]);
        setShowHistory(false);
        setStreamText("");
        setSuggestions("");
        setStreamSuggestion("");
        setSuggestionItems([]);
        setBatchSuggestionItems([]);
        setErrorDetection(null);
        setSummaryText("");
        setPolishedText("");
        setSpacingText("");
        
        // 새 사용자 설정
        setUser(data.user);
        setLoginError(""); // 로그인 성공 시 에러 메시지 초기화
        showToast("✅ 로그인 성공!");
        console.log("로그인 성공:", data.user);
        console.log("사용자 ID:", data.user.id);
      } else {
        showToast("⚠️ 로그인 응답이 없습니다. Supabase 설정을 확인해주세요.");
        console.error("로그인 응답에 user가 없습니다:", data);
      }
    } catch (error) {
      console.error("로그인 실패:", error);
      let errorMessage = error.message || "알 수 없는 오류가 발생했습니다.";
      
      // Supabase 에러 코드에 따라 적절한 메시지 표시
      if (error.status === 400 || error.message?.includes("Invalid login credentials") || error.message?.includes("invalid_credentials")) {
        errorMessage = "아이디(또는 이메일) 또는 비밀번호가 올바르지 않습니다.";
      } else if (errorMessage.includes("Email not confirmed") || errorMessage.includes("email_not_confirmed")) {
        errorMessage = "이메일 확인이 필요합니다. 📧 가입하신 이메일을 확인해주세요.";
      } else if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("환경 변수")) {
        errorMessage = "서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.";
        console.error("Supabase 연결 오류 - 환경 변수를 확인하세요:");
        console.error("REACT_APP_SUPABASE_URL:", process.env.REACT_APP_SUPABASE_URL ? "설정됨" : "설정 안됨");
        console.error("REACT_APP_SUPABASE_ANON_KEY:", process.env.REACT_APP_SUPABASE_ANON_KEY ? "설정됨" : "설정 안됨");
      }
      
      // 에러 메시지를 state에 저장하여 폼에 표시
      setLoginError(errorMessage);
      showToast("❌ " + errorMessage);
    }
  };

  // 회원가입 함수 (아이디 또는 이메일 지원)
  const handleSignUp = async (identifier, password) => {
    // 에러 메시지 초기화
    setSignUpError("");
    
    // Supabase 클라이언트 확인
    if (!supabase) {
      const errorMsg = "Supabase가 초기화되지 않았습니다. 환경 변수를 확인하세요.";
      setSignUpError(errorMsg);
      showToast("❌ " + errorMsg);
      console.error("Supabase 클라이언트가 없습니다.");
      return;
    }

    // 입력 검증 추가
    if (!identifier || !identifier.trim()) {
      const errorMsg = "아이디 또는 이메일을 입력해주세요.";
      setSignUpError(errorMsg);
      showToast("⚠️ " + errorMsg);
      console.error("아이디/이메일이 비어있습니다.");
      return;
    }
    
    if (!password || password.length < 6) {
      const errorMsg = "비밀번호는 최소 6자 이상이어야 합니다.";
      setSignUpError(errorMsg);
      showToast("⚠️ " + errorMsg);
      console.error("비밀번호가 너무 짧습니다.");
      return;
    }

    // 아이디/이메일 처리: @가 없으면 아이디로 간주하여 @temp.local 추가
    let email = identifier.trim();
    let username = identifier.trim();
    if (!email.includes('@')) {
      email = `${email}@temp.local`;
    } else {
      // 이메일 형식이면 @ 앞부분을 사용자 이름으로 사용
      username = email.split('@')[0];
    }

    try {
      console.log("회원가입 시도:", email, "사용자 이름:", username);
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: username, // 사용자 이름을 메타데이터에 저장
            display_name: username
          }
        }
      });
      
      console.log("회원가입 응답:", { data, error });
      
      if (error) {
        console.error("회원가입 에러:", error);
        throw error;
      }
      
      if (data?.user) {
        // 회원가입 성공 시 자동 로그인하지 않고 로그인 페이지로 돌아감
        console.log("회원가입 성공:", data.user);
        setSignUpSuccess(true); // 성공 상태 설정
        setSignUpError(""); // 에러 메시지 초기화
        
        // 회원가입 폼 초기화
        const signupEmailInput = document.getElementById("signup-email");
        const signupPasswordInput = document.getElementById("signup-password");
        if (signupEmailInput) signupEmailInput.value = "";
        if (signupPasswordInput) signupPasswordInput.value = "";
        
        // 회원가입 후 자동 로그인 방지를 위해 명시적으로 로그아웃
        try {
          await supabase.auth.signOut();
          setUser(null);
          console.log("회원가입 후 로그아웃 처리 완료");
        } catch (signOutError) {
          console.error("로그아웃 오류 (무시 가능):", signOutError);
        }
        
        // 2초 후 모달 닫기 및 토스트 메시지 표시
        setTimeout(() => {
          setShowSignUpModal(false);
          setSignUpSuccess(false);
          showToast("✅ 회원가입이 완료되었습니다! 로그인해주세요.");
        }, 2000);
        
        // 자동 로그인하지 않음 (user 상태를 null로 유지)
      } else {
        const errorMsg = "회원가입 응답이 없습니다. Supabase 설정을 확인해주세요.";
        setSignUpError(errorMsg);
        showToast("⚠️ " + errorMsg);
        console.error("회원가입 응답에 user가 없습니다:", data);
      }
    } catch (error) {
      console.error("회원가입 실패:", error);
      let errorMessage = error.message || "알 수 없는 오류가 발생했습니다.";
      
      // Supabase 에러 코드에 따라 적절한 메시지 표시
      if (error.status === 400 || error.message?.includes("already registered") || error.message?.includes("User already registered")) {
        errorMessage = "이미 가입된 아이디(또는 이메일)입니다.";
      } else if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
        errorMessage = "서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.";
        console.error("Supabase 연결 오류 - 환경 변수를 확인하세요:");
        console.error("REACT_APP_SUPABASE_URL:", process.env.REACT_APP_SUPABASE_URL ? "설정됨" : "설정 안됨");
        console.error("REACT_APP_SUPABASE_ANON_KEY:", process.env.REACT_APP_SUPABASE_ANON_KEY ? "설정됨" : "설정 안됨");
      }
      
      // 에러 메시지를 state에 저장하여 폼에 표시
      setSignUpError(errorMessage);
      showToast("❌ 회원가입 실패: " + errorMessage);
    }
  };

  // 로그아웃 함수
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // 모든 상태 초기화
      setUser(null);
      setInput("");
      setSavedTexts([]);
      setShowHistory(false);
      setStreamText("");
      setSuggestions("");
      setStreamSuggestion("");
      setSuggestionItems([]);
      setBatchSuggestionItems([]);
      setErrorDetection(null);
      setSummaryText("");
      setPolishedText("");
      setSpacingText("");
      setLoginError("");
      setSignUpError("");
      setShowSignUpModal(false);
      
      showToast("✅ 로그아웃되었습니다.");
    } catch (error) {
      showToast("❌ 로그아웃 실패: " + error.message);
    }
  };


  // ============================================================
  // 1️⃣1-1️⃣ 저장된 텍스트 히스토리 불러오기
  // ============================================================
  const loadHistory = useCallback(async () => {
    if (!user) {
      console.warn("loadHistory: 사용자가 로그인하지 않았습니다.");
      showToast("⚠️ 로그인이 필요합니다.");
      return;
    }

    if (!supabase) {
      console.error("Supabase 클라이언트가 없습니다.");
      showToast("❌ Supabase가 초기화되지 않았습니다.");
      return;
    }

    console.log("loadHistory 시작 - user.id:", user.id);
    console.log("현재 로그인한 사용자:", user.email || user.user_metadata?.username);
    setIsLoadingHistory(true);
    try {
      // 프론트엔드에서 직접 Supabase 조회 (RLS 정책 통과)
      // user.id로 정확히 필터링하여 현재 사용자의 데이터만 가져옴
      const { data, error } = await supabase
        .from("text_history")
        .select("*")
        .eq("user_id", user.id) // 현재 로그인한 사용자의 ID로만 필터링
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) {
        console.error("히스토리 로드 실패:", error);
        throw new Error(error.message || "히스토리 불러오기 실패");
      }
      
      const texts = data || [];
      console.log("조회된 데이터 개수:", texts.length);
      if (texts.length > 0) {
        console.log("첫 번째 데이터의 user_id:", texts[0].user_id);
        console.log("현재 사용자 ID와 일치:", texts[0].user_id === user.id);
      }
      setSavedTexts(texts);
      console.log("히스토리 로드 성공:", texts.length, "개");
      if (texts.length === 0) {
        console.log("저장된 텍스트가 없습니다.");
      }
    } catch (err) {
      console.error("History load error:", err);
      showToast("❌ 히스토리 불러오기 실패: " + err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user, showToast]);

  // ============================================================
  // 1️⃣1️⃣ 텍스트 저장 (Supabase)
  // ============================================================
  const handleSaveText = useCallback(async () => {
    try {
      if (!input.trim()) {
        showToast("⚠️ 저장할 텍스트가 없습니다.");
        return;
      }
      
      if (!user) {
        showToast("⚠️ 로그인이 필요합니다.");
        return;
      }

      if (!supabase) {
        showToast("❌ Supabase가 초기화되지 않았습니다.");
        return;
      }
      
      // 글자 수와 단어 수 계산
      const charCount = input.length;
      const wordCount = input.split(/\s+/).filter(word => word.length > 0).length;
      
      console.log("텍스트 저장 시도 - user.id:", user.id);
      console.log("현재 로그인한 사용자:", user.email || user.user_metadata?.username);
      
      // 프론트엔드에서 직접 Supabase에 저장 (RLS 정책 통과)
      const { data, error } = await supabase
        .from("text_history")
        .insert({
          user_id: user.id, // 현재 로그인한 사용자의 ID로 저장
          content: input,
          tone: highlightMode,
          char_count: charCount,
          word_count: wordCount
        })
        .select()
        .single();
      
      if (data) {
        console.log("저장된 데이터의 user_id:", data.user_id);
        console.log("현재 사용자 ID와 일치:", data.user_id === user.id);
      }
      
      if (error) {
        console.error("Supabase 저장 오류:", error);
        throw new Error(error.message || "저장 실패");
      }
      
      if (data) {
        showToast("✅ 텍스트가 클라우드에 저장되었습니다!");
        console.log("저장 성공:", data);
        
        // 저장 성공 후 항상 최신 목록 가져오기
        if (user && supabase) {
          console.log("저장 후 히스토리 새로고침 시작...");
          // 목록이 열려있을 때만 로딩 상태 표시
          if (showHistory) {
            setIsLoadingHistory(true);
          }
          try {
            // 프론트엔드에서 직접 Supabase 조회
            const { data: historyData, error: historyError } = await supabase
              .from("text_history")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(50);
            
            if (historyError) {
              console.error("히스토리 새로고침 오류:", historyError);
            } else {
              setSavedTexts(historyData || []);
              console.log("히스토리 새로고침 완료:", historyData?.length || 0, "개");
            }
          } catch (err) {
            console.error("히스토리 새로고침 오류:", err);
          } finally {
            if (showHistory) {
              setIsLoadingHistory(false);
            }
          }
        }
      } else {
        throw new Error("저장 실패: 응답 데이터가 없습니다.");
      }
    } catch (err) {
      console.error("Save error:", err);
      showToast("❌ 저장 중 오류가 발생했습니다: " + err.message);
    }
  }, [input, highlightMode, user, showToast, showHistory]);

  // ============================================================
  // 1️⃣1-2️⃣ 저장된 텍스트 불러오기
  // ============================================================
  const handleLoadSavedText = useCallback((savedText) => {
    setInput(savedText.content || "");
    setHighlightMode(savedText.tone || "자동 감지");
    showToast("✅ 텍스트를 불러왔습니다!");
    setShowHistory(false); // 히스토리 패널 닫기
  }, [showToast]);

  // ============================================================
  // 1️⃣1-3️⃣ 저장된 텍스트 삭제
  // ============================================================
  const handleDeleteSavedText = useCallback(async (textId) => {
    if (!user) {
      showToast("⚠️ 로그인이 필요합니다.");
      return;
    }

    if (!supabase) {
      showToast("❌ Supabase가 초기화되지 않았습니다.");
      return;
    }
    
    if (!window.confirm("정말 이 텍스트를 삭제하시겠습니까?")) {
      return;
    }

    try {
      // Supabase에서 직접 삭제
      const { error } = await supabase
        .from("text_history")
        .delete()
        .eq("id", textId)
        .eq("user_id", user.id);

      if (error) throw error;

      showToast("✅ 텍스트가 삭제되었습니다!");
      loadHistory(); // 목록 새로고침
    } catch (err) {
      console.error("Delete error:", err);
      showToast("❌ 삭제 중 오류가 발생했습니다: " + err.message);
    }
  }, [user, showToast, loadHistory]);

  // 사용자 로그인 시 히스토리 자동 로드
  useEffect(() => {
    if (user && showHistory) {
      loadHistory();
    }
  }, [user, showHistory, loadHistory]);

  // ============================================================
  // 1️⃣2️⃣ 텍스트 불러오기 (로컬 스토리지)
  // ============================================================
  const handleLoadText = useCallback(() => {
    try {
      const saved = localStorage.getItem("savedText");
      if (saved) {
        setInput(saved);
        showToast("✅ 텍스트를 불러왔습니다!");
      } else {
        showToast("ℹ️ 저장된 텍스트가 없습니다.");
      }
    } catch (err) {
      console.error("Load error:", err);
      showToast("❌ 불러오기 중 오류가 발생했습니다.");
    }
  }, [showToast]);

  // ============================================================
  // 1️⃣3️⃣ 텍스트 복사
  // ============================================================
  const handleCopyText = useCallback(async () => {
    try {
      if (!input.trim()) {
        showToast("⚠️ 복사할 텍스트가 없습니다.");
        return;
      }
      await navigator.clipboard.writeText(input);
      showToast("✅ 텍스트가 클립보드에 복사되었습니다!");
    } catch (err) {
      console.error("Copy error:", err);
      showToast("❌ 복사 중 오류가 발생했습니다.");
    }
  }, [input, showToast]);

  // ============================================================
  // 1️⃣4️⃣ 텍스트 다운로드
  // ============================================================
  const handleDownloadText = useCallback(() => {
    try {
      if (!input.trim()) {
        showToast("⚠️ 다운로드할 텍스트가 없습니다.");
        return;
      }
      const blob = new Blob([input], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `글쓰기_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("✅ 텍스트가 다운로드되었습니다!");
    } catch (err) {
      console.error("Download error:", err);
      showToast("❌ 다운로드 중 오류가 발생했습니다.");
    }
  }, [input, showToast]);

  // ============================================================
  // 1️⃣5️⃣ 텍스트 초기화
  // ============================================================
  const handleClearText = useCallback(() => {
    if (!input.trim()) {
      showToast("ℹ️ 삭제할 텍스트가 없습니다.");
      return;
    }
    if (window.confirm("작성 중인 텍스트를 모두 삭제하시겠습니까?")) {
      setInput("");
      setStreamText("");
      setSuggestions("");
      setStreamSuggestion("");
      setSuggestionItems([]);
      setBatchSuggestionItems([]);
      setErrorDetection(null);
      showToast("✅ 텍스트가 초기화되었습니다!");
    }
  }, [input, showToast]);

  // ============================================================
  // JSX 렌더링 - 2패널 레이아웃
  // ============================================================
  return (
    <div className="App" style={{ minHeight: '100vh' }}>
      <h2>나랏말쓴이 v2.5 — 사고 확장형 문맥 보조 시스템</h2>

      {/* 로그인 화면 */}
      {!user ? (
        <div className="login-container" style={{
          maxWidth: '400px',
          margin: '50px auto',
          padding: '30px',
          background: 'rgba(30, 30, 46, 0.95)',
          borderRadius: '15px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#00bcd4' }}>로그인</h2>
          <div className="login-form">
            <input
              type="text"
              placeholder="아이디 또는 이메일"
              id="login-email"
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(26, 26, 46, 0.6)',
                color: '#f2f2f2',
                fontSize: '14px'
              }}
            />
            <input
              type="password"
              placeholder="비밀번호"
              id="login-password"
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '15px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(26, 26, 46, 0.6)',
                color: '#f2f2f2',
                fontSize: '14px'
              }}
            />
            {loginError && (
              <div style={{
                padding: '10px',
                marginBottom: '15px',
                borderRadius: '8px',
                background: 'rgba(244, 67, 54, 0.2)',
                border: '1px solid rgba(244, 67, 54, 0.5)',
                color: '#ff6b6b',
                fontSize: '13px',
                textAlign: 'center'
              }}>
                {loginError}
              </div>
            )}
            <div className="login-buttons" style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  console.log("로그인 버튼 클릭됨");
                  const email = document.getElementById("login-email")?.value || "";
                  const password = document.getElementById("login-password")?.value || "";
                  console.log("입력값:", { email, password: password ? "***" : "" });
                  if (email && password) {
                    setLoginError(""); // 에러 메시지 초기화
                    handleLogin(email, password);
                  } else {
                    setLoginError("아이디(또는 이메일)와 비밀번호를 모두 입력해주세요.");
                    showToast("⚠️ 아이디(또는 이메일)와 비밀번호를 모두 입력해주세요.");
                  }
                }} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
              >
                로그인
              </button>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setShowSignUpModal(true);
                  setSignUpError("");
                  setSignUpSuccess(false);
                  setSignUpError("");
                }} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
              >
                회원가입
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 사이드바 레이아웃 */}
          <div className="sidebar-layout">
            {/* 왼쪽 사이드바 */}
            <div className="sidebar">
              {/* 사용자 정보 */}
              <div className="sidebar-user-section">
                <div className="sidebar-user-info">
                  <span className="sidebar-user-avatar">👤</span>
                  <div className="sidebar-user-details">
                    <span className="sidebar-user-name">
                      {user.user_metadata?.username || user.user_metadata?.display_name || user.email?.split('@')[0] || '사용자'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="sidebar-logout-btn"
                  title="로그아웃"
                >
                  🚪 로그아웃
                </button>
              </div>

              {/* 네비게이션 메뉴 */}
              <nav className="sidebar-nav">
                <button 
                  className={`sidebar-nav-item ${activeTab === "작성" ? "active" : ""}`}
                  onClick={() => setActiveTab("작성")}
                >
                  <span className="nav-icon">✍️</span>
                  <span className="nav-label">작성</span>
                </button>
                <button 
                  className={`sidebar-nav-item ${activeTab === "설정" ? "active" : ""}`}
                  onClick={() => setActiveTab("설정")}
                >
                  <span className="nav-icon">⚙️</span>
                  <span className="nav-label">설정</span>
                </button>
              </nav>
            </div>

            {/* 메인 콘텐츠 영역 */}
            <div className="main-content-area">
              <div className="main-container">
                {/* 좌측 패널: 작성 공간 */}
                <div className="left-panel">
              {/* 작성 영역 아코디언 */}
              <div className="accordion-section">
                <div 
                  className="accordion-header"
                  onClick={() => toggleAccordion('writing')}
                >
                  <h3>✍️ 작성 영역</h3>
                  <span className={`accordion-icon ${accordionStates.writing ? 'open' : ''}`}>▼</span>
                </div>
                {accordionStates.writing && (
                  <div className="accordion-content">
                    <div className="input-section">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="문장을 입력하세요..."
                        className="main-textarea"
                      />

                      <div className="text-stats">
                        <span className="stat-item">글자 수: <strong>{charCount.toLocaleString()}</strong></span>
                        <span className="stat-item">단어 수: <strong>{wordCount.toLocaleString()}</strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI 기능 아코디언 */}
              {activeTab === "작성" && (
                <div className="accordion-section">
                  <div 
                    className="accordion-header"
                    onClick={() => toggleAccordion('aiFeatures')}
                  >
                    <h3>🤖 AI 기능</h3>
                    <span className={`accordion-icon ${accordionStates.aiFeatures ? 'open' : ''}`}>▼</span>
                  </div>
                  {accordionStates.aiFeatures && (
                    <div className="accordion-content">
                      <div className="btn-group">
                        <button onClick={handleStream} disabled={isStreaming} className="ai-btn" title="AI가 다음에 올 문장을 실시간으로 예측합니다">
                          {isStreaming ? "⏳ 예측 중..." : "✍️ 실시간 예측"}
                        </button>
                        <button onClick={handleSuggest} className="ai-btn" title="여러 문장 제안을 한 번에 받습니다">
                          💡 문장 제안 (일괄)
                        </button>
                        <button onClick={handleSuggestStream} disabled={isSuggestStreaming} className="ai-btn" title="문장 제안을 실시간으로 받습니다">
                          {isSuggestStreaming ? "⏳ 제안 중..." : "💡 실시간 제안"}
                        </button>
                        <button onClick={handleDetectErrors} disabled={isDetecting} className="ai-btn" title="오타와 문법 오류를 찾아줍니다">
                          {isDetecting ? "⏳ 탐지 중..." : "🔍 오타·문법 탐지"}
                        </button>
                        <button onClick={handleSummarize} disabled={isSummarizing} className="ai-btn" title="텍스트의 핵심 내용을 요약해줍니다">
                          {isSummarizing ? "⏳ 요약 중..." : "📝 텍스트 요약"}
                        </button>
                        <button onClick={handlePolish} disabled={isPolishing} className="ai-btn" title="문장을 자연스럽게 연결하고 다듬어줍니다">
                          {isPolishing ? "⏳ 다듬는 중..." : "✨ 텍스트 다듬기"}
                        </button>
                        <button onClick={handleCorrectSpacing} disabled={isCorrectingSpacing} className="ai-btn" title="한국어 띄어쓰기를 올바르게 교정해줍니다">
                          {isCorrectingSpacing ? "⏳ 교정 중..." : "📝 띄어쓰기 교정"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 문체 모드 아코디언 */}
              {activeTab === "작성" && (
                <div className="accordion-section">
                  <div 
                    className="accordion-header"
                    onClick={() => toggleAccordion('toneMode')}
                  >
                    <h3>📝 문체 모드</h3>
                    <span className={`accordion-icon ${accordionStates.toneMode ? 'open' : ''}`}>▼</span>
                  </div>
                  {accordionStates.toneMode && (
                    <div className="accordion-content">
                      <div className="highlight-mode">
                        <span className="mode-label">문체 선택:</span>
                        {["감성적", "논리적", "설명적", "서사적", "자동 감지"].map((mode) => (
                          <button
                            key={mode}
                            className={`mode-btn ${highlightMode === mode ? "active" : ""}`}
                            onMouseEnter={() => handleHover(mode)}
                            onMouseLeave={() => setHoverPreview("")}
                            onClick={() => setHighlightMode(mode)}
                            title={mode === "감성적" ? "따뜻하고 공감형 문체" : 
                                   mode === "논리적" ? "논거와 분석 중심 문체" :
                                   mode === "설명적" ? "정보를 풀어주는 서술형 문체" :
                                   mode === "서사적" ? "이야기 흐름 중심 문체" :
                                   "AI가 문체를 자동으로 판단"}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                      {hoverPreview && <div className="hover-preview">{hoverPreview}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* 유틸리티 아코디언 */}
              {activeTab === "설정" && (
                <div className="accordion-section">
                  <div 
                    className="accordion-header"
                    onClick={() => toggleAccordion('utility')}
                  >
                    <h3>🛠️ 유틸리티</h3>
                    <span className={`accordion-icon ${accordionStates.utility ? 'open' : ''}`}>▼</span>
                  </div>
                  {accordionStates.utility && (
                    <div className="accordion-content">
                      <div className="btn-group utility-buttons">
                        <button onClick={handleSaveText} className="utility-btn" title="현재 텍스트를 클라우드에 저장합니다">💾 저장</button>
                        <button 
                          onClick={async () => {
                            const willShow = !showHistory;
                            setShowHistory(willShow);
                            if (willShow && user) {
                              console.log("저장 목록 버튼 클릭 - 히스토리 로드 시작");
                              await loadHistory();
                            }
                            if (willShow) {
                              setAccordionStates(prev => ({ ...prev, savedTexts: true }));
                            }
                          }} 
                          className={`utility-btn ${showHistory ? "active" : ""}`}
                          title="저장된 텍스트 목록을 확인합니다"
                        >
                          📚 저장 목록
                        </button>
                        <button onClick={handleCopyText} className="utility-btn" title="텍스트를 클립보드에 복사합니다">📋 복사</button>
                        <button onClick={handleDownloadText} className="utility-btn" title="텍스트를 파일로 다운로드합니다">⬇️ 다운로드</button>
                        <button onClick={handleClearText} className="utility-btn clear-btn" title="작성 중인 텍스트를 모두 삭제합니다">🗑️ 초기화</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

                </div>

                {/* 우측 패널: AI 결과 */}
                <div className="right-panel">
                  {/* 실시간 제안 아코디언 */}
                  {(streamSuggestion || suggestionItems.length > 0 || isSuggestStreaming) && (
                    <div className="accordion-section" ref={suggestionRef}>
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('suggestStream')}
                      >
                        <h3>💡 실시간 제안</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeAiResult('suggestStream');
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.suggestStream ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                    {accordionStates.suggestStream && (
                      <div className="accordion-content">
                        {isSuggestStreaming ? (
                          <p className="loading">AI가 실시간 제안 중...</p>
                        ) : suggestionItems.length > 0 ? (
                          <div className="suggestion-content">
                            {suggestionItems.map((item) => (
                              <div key={item.id} className="suggestion-item-cursor">
                                <div className="suggestion-item-content">
                                  <span className="suggestion-text">{item.text}</span>
                                </div>
                                <div className="suggestion-actions">
                                  <div className="accept-dropdown-wrapper">
                                    <button
                                      className="accept-btn"
                                      onClick={() => setAcceptDropdownOpen(acceptDropdownOpen === `suggestStream-${item.id}` ? null : `suggestStream-${item.id}`)}
                                      title="채택 옵션"
                                    >
                                      ✓ 채택 <span className="dropdown-arrow">▼</span>
                                    </button>
                                    {acceptDropdownOpen === `suggestStream-${item.id}` && (
                                      <div className="accept-dropdown-menu">
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => handleAcceptSuggestionAppend(item.text)}
                                          title="기존 텍스트에 이어서 추가"
                                        >
                                          ➕ 이어쓰기
                                        </button>
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => handleAcceptSuggestionReplace(item.text)}
                                          title="기존 텍스트를 완전히 교체"
                                        >
                                          🔄 교체
                                        </button>
                                      </div>
                                    )}
                                  </div>
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
                    )}
                    </div>
                  )}

                  {/* 실시간 예측 결과 아코디언 */}
                  {(streamText || isStreaming) && (
                    <div className="accordion-section">
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('stream')}
                      >
                        <h3>✍️ 실시간 예측</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeAiResult('stream');
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.stream ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                      {accordionStates.stream && (
                        <div className="accordion-content">
                          {isStreaming && !streamText ? (
                            <p className="loading">AI가 예측 중입니다...</p>
                          ) : streamText ? (
                            <div className="suggestion-content">
                              <div className="suggestion-item-cursor">
                                <div className="suggestion-item-content">
                                  <span className="suggestion-text">{streamText}</span>
                                </div>
                                <div className="suggestion-actions">
                                  <div className="accept-dropdown-wrapper">
                                    <button
                                      className="accept-btn"
                                      onClick={() => setAcceptDropdownOpen(acceptDropdownOpen === 'stream' ? null : 'stream')}
                                      title="채택 옵션"
                                    >
                                      ✓ 채택 <span className="dropdown-arrow">▼</span>
                                    </button>
                                    {acceptDropdownOpen === 'stream' && (
                                      <div className="accept-dropdown-menu">
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => handleAcceptSuggestionAppend(streamText)}
                                          title="기존 텍스트에 이어서 추가"
                                        >
                                          ➕ 이어쓰기
                                        </button>
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => handleAcceptSuggestionReplace(streamText)}
                                          title="기존 텍스트를 완전히 교체"
                                        >
                                          🔄 교체
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="reject-btn"
                                    onClick={() => closeAiResult('stream')}
                                    title="거절"
                                  >
                                    ✕ 거절
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="empty-state">실시간 예측 결과가 여기에 표시됩니다</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 문장 제안 (일괄) 아코디언 */}
                  {(batchSuggestionItems.length > 0 || suggestions) && (
                    <div className="accordion-section">
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('suggest')}
                      >
                        <h3>💡 문장 제안 (일괄)</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeAiResult('suggest');
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.suggest ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                      {accordionStates.suggest && (
                        <div className="accordion-content">
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
                                    <div className="accept-dropdown-wrapper">
                                      <button
                                        className="accept-btn"
                                        onClick={() => setAcceptDropdownOpen(acceptDropdownOpen === `suggest-${item.id}` ? null : `suggest-${item.id}`)}
                                        title="채택 옵션"
                                      >
                                        ✓ 채택 <span className="dropdown-arrow">▼</span>
                                      </button>
                                      {acceptDropdownOpen === `suggest-${item.id}` && (
                                        <div className="accept-dropdown-menu">
                                          <button
                                            className="accept-dropdown-item"
                                            onClick={() => handleAcceptSuggestionAppend(item.text)}
                                            title="기존 텍스트에 이어서 추가"
                                          >
                                            ➕ 이어쓰기
                                          </button>
                                          <button
                                            className="accept-dropdown-item"
                                            onClick={() => handleAcceptSuggestionReplace(item.text)}
                                            title="기존 텍스트를 완전히 교체"
                                          >
                                            🔄 교체
                                          </button>
                                        </div>
                                      )}
                                    </div>
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
                  )}

                  {/* 저장된 텍스트 목록 아코디언 */}
                  {showHistory && (
                    <div className="accordion-section">
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('savedTexts')}
                      >
                        <h3>📚 저장된 글 목록</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowHistory(false);
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.savedTexts ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                      {accordionStates.savedTexts && (
                        <div className="accordion-content saved-texts-content">
                          {isLoadingHistory ? (
                            <p style={{ 
                              textAlign: 'center', 
                              color: '#00bcd4',
                              fontSize: '15px',
                              fontWeight: '500',
                              padding: '40px 20px',
                              opacity: 0.8
                            }}>
                              ⏳ 로딩 중...
                            </p>
                          ) : savedTexts.length === 0 ? (
                            <p style={{ 
                              textAlign: 'center', 
                              color: '#888',
                              fontSize: '14px',
                              padding: '40px 20px',
                              fontStyle: 'italic'
                            }}>
                              저장된 글이 없습니다.
                            </p>
                          ) : (
                            <div className="saved-texts-list">
                              {savedTexts.map((item) => (
                                <div
                                  key={item.id}
                                  style={{
                                    background: 'linear-gradient(135deg, rgba(30, 30, 46, 0.9) 0%, rgba(26, 26, 40, 0.9) 100%)',
                                    borderRadius: '12px',
                                    padding: '18px',
                                    marginBottom: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                    backdropFilter: 'blur(10px)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(0, 188, 212, 0.5)';
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(40, 40, 56, 0.95) 0%, rgba(36, 36, 50, 0.95) 100%)';
                                    e.currentTarget.style.transform = 'translateX(4px)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 188, 212, 0.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30, 30, 46, 0.9) 0%, rgba(26, 26, 40, 0.9) 100%)';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                                  }}
                                >
                                  <div
                                    onClick={() => handleLoadSavedText(item)}
                                    style={{ marginBottom: '10px' }}
                                  >
                                    <div style={{
                                      fontSize: '12px',
                                      color: '#00bcd4',
                                      marginBottom: '8px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <span>
                                        {new Date(item.created_at).toLocaleString('ko-KR', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#b0b0b0' }}>
                                        {item.tone || '자동 감지'}
                                      </span>
                                    </div>
                                    <div style={{
                                      color: '#f2f2f2',
                                      fontSize: '14px',
                                      lineHeight: '1.5',
                                      maxHeight: '60px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: 'vertical'
                                    }}>
                                      {item.content}
                                    </div>
                                    <div style={{
                                      fontSize: '11px',
                                      color: '#b0b0b0',
                                      marginTop: '8px'
                                    }}>
                                      글자 수: {item.char_count || 0} | 단어 수: {item.word_count || 0}
                                    </div>
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    gap: '8px',
                                    justifyContent: 'flex-end',
                                    marginTop: '8px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                                  }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLoadSavedText(item);
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: 'rgba(0, 188, 212, 0.2)',
                                        border: '1px solid rgba(0, 188, 212, 0.5)',
                                        color: '#00bcd4',
                                        fontSize: '12px'
                                      }}
                                    >
                                      불러오기
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSavedText(item.id);
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: '#f2f2f2',
                                        fontSize: '12px'
                                      }}
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 오타·문법 탐지 결과 아코디언 */}
                  {errorDetection && (
                    <div className="accordion-section">
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('error')}
                      >
                        <h3>🔍 오타·문법 탐지</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeAiResult('error');
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.error ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                      {accordionStates.error && (
                        <div className="accordion-content">
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
                                  <div className="error-actions" style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '10px',
                                    justifyContent: 'flex-end'
                                  }}>
                                    <button
                                      className="accept-btn"
                                      onClick={() => handleAcceptErrorCorrection(err.original, err.corrected)}
                                      title="수정 채택"
                                      style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: 'rgba(0, 188, 212, 0.2)',
                                        border: '1px solid rgba(0, 188, 212, 0.5)',
                                        color: '#00bcd4',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                      }}
                                    >
                                      ✓ 채택
                                    </button>
                                    <button
                                      className="reject-btn"
                                      onClick={() => handleRejectErrorCorrection(idx)}
                                      title="수정 거절"
                                      style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: '#f2f2f2',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                      }}
                                    >
                                      ✕ 거절
                                    </button>
                                  </div>
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
                  )}

                  {/* 텍스트 요약 결과 아코디언 */}
                  {(summaryText || isSummarizing) && (
                    <div className="accordion-section">
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('summary')}
                      >
                        <h3>📝 텍스트 요약</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeAiResult('summary');
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.summary ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                      {accordionStates.summary && (
                        <div className="accordion-content">
                          {isSummarizing ? (
                            <p className="loading">AI가 요약 중입니다...</p>
                          ) : summaryText ? (
                            <div className="suggestion-content">
                              <div className="suggestion-item-cursor">
                                <div className="suggestion-item-content">
                                  <span className="suggestion-text">{summaryText}</span>
                                </div>
                                <div className="suggestion-actions">
                                  <div className="accept-dropdown-wrapper">
                                    <button
                                      className="accept-btn"
                                      onClick={() => setAcceptDropdownOpen(acceptDropdownOpen === 'summary' ? null : 'summary')}
                                      title="채택 옵션"
                                    >
                                      ✓ 채택 <span className="dropdown-arrow">▼</span>
                                    </button>
                                    {acceptDropdownOpen === 'summary' && (
                                      <div className="accept-dropdown-menu">
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => {
                                            handleAcceptSuggestionAppend(summaryText);
                                            showToast("✅ 요약 내용이 이어서 추가되었습니다.");
                                          }}
                                          title="기존 텍스트에 이어서 추가"
                                        >
                                          ➕ 이어쓰기
                                        </button>
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => {
                                            handleAcceptSuggestionReplace(summaryText);
                                            showToast("✅ 요약 내용으로 교체되었습니다.");
                                          }}
                                          title="기존 텍스트를 완전히 교체"
                                        >
                                          🔄 교체
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="reject-btn"
                                    onClick={() => closeAiResult('summary')}
                                    title="거절"
                                  >
                                    ✕ 거절
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="empty-state">요약 결과가 여기에 표시됩니다</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 텍스트 다듬기 결과 아코디언 */}
                  {(polishedText || isPolishing) && (
                    <div className="accordion-section">
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('polish')}
                      >
                        <h3>✨ 텍스트 다듬기</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeAiResult('polish');
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.polish ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                      {accordionStates.polish && (
                        <div className="accordion-content">
                          {isPolishing ? (
                            <p className="loading">AI가 텍스트를 다듬는 중입니다...</p>
                          ) : polishedText ? (
                            <div className="suggestion-content">
                              <div className="suggestion-item-cursor">
                                <p className="suggestion-text">{polishedText}</p>
                                <div className="suggestion-actions">
                                  <div className="accept-dropdown-wrapper">
                                    <button
                                      className="accept-btn"
                                      onClick={() => setAcceptDropdownOpen(acceptDropdownOpen === 'polish' ? null : 'polish')}
                                      title="채택 옵션"
                                    >
                                      ✓ 채택 <span className="dropdown-arrow">▼</span>
                                    </button>
                                    {acceptDropdownOpen === 'polish' && (
                                      <div className="accept-dropdown-menu">
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => {
                                            handleAcceptSuggestionAppend(polishedText);
                                            showToast("✅ 다듬어진 텍스트가 이어서 추가되었습니다.");
                                          }}
                                          title="기존 텍스트에 이어서 추가"
                                        >
                                          ➕ 이어쓰기
                                        </button>
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => {
                                            handleAcceptSuggestionReplace(polishedText);
                                            showToast("✅ 다듬어진 텍스트로 교체되었습니다.");
                                          }}
                                          title="기존 텍스트를 완전히 교체"
                                        >
                                          🔄 교체
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="reject-btn"
                                    onClick={() => closeAiResult('polish')}
                                    title="거절"
                                  >
                                    ✕ 거절
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="empty-state">다듬기 결과가 여기에 표시됩니다</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 띄어쓰기 교정 결과 아코디언 */}
                  {(spacingText || isCorrectingSpacing) && (
                    <div className="accordion-section">
                      <div 
                        className="accordion-header"
                        onClick={() => toggleAccordion('spacing')}
                      >
                        <h3>📝 띄어쓰기 교정</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeAiResult('spacing');
                            }}
                            className="close-btn-mini"
                            title="닫기"
                          >
                            ✕
                          </button>
                          <span className={`accordion-icon ${accordionStates.spacing ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>
                      {accordionStates.spacing && (
                        <div className="accordion-content">
                          {isCorrectingSpacing ? (
                            <p className="loading">AI가 띄어쓰기를 교정하는 중입니다...</p>
                          ) : spacingText ? (
                            <div className="suggestion-content">
                              <div className="suggestion-item-cursor">
                                <div className="suggestion-item-content">
                                  <span className="suggestion-text">{spacingText}</span>
                                </div>
                                <div className="suggestion-actions">
                                  <div className="accept-dropdown-wrapper">
                                    <button
                                      className="accept-btn"
                                      onClick={() => setAcceptDropdownOpen(acceptDropdownOpen === 'spacing' ? null : 'spacing')}
                                      title="채택 옵션"
                                    >
                                      ✓ 채택 <span className="dropdown-arrow">▼</span>
                                    </button>
                                    {acceptDropdownOpen === 'spacing' && (
                                      <div className="accept-dropdown-menu">
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => {
                                            handleAcceptSuggestionAppend(spacingText);
                                            showToast("✅ 교정된 텍스트가 이어서 추가되었습니다.");
                                          }}
                                          title="기존 텍스트에 이어서 추가"
                                        >
                                          ➕ 이어쓰기
                                        </button>
                                        <button
                                          className="accept-dropdown-item"
                                          onClick={() => {
                                            handleAcceptSuggestionReplace(spacingText);
                                            showToast("✅ 교정된 텍스트로 교체되었습니다.");
                                          }}
                                          title="기존 텍스트를 완전히 교체"
                                        >
                                          🔄 교체
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="reject-btn"
                                    onClick={() => closeAiResult('spacing')}
                                    title="거절"
                                  >
                                    ✕ 거절
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="empty-state">띄어쓰기 교정 결과가 여기에 표시됩니다</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 회원가입 모달 */}
      {showSignUpModal && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSignUpModal(false);
              setSignUpError("");
              setSignUpSuccess(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(5px)'
          }}
        >
          <div 
            className="modal-container"
            style={{
              background: 'rgba(30, 30, 46, 0.95)',
              borderRadius: '15px',
              padding: '30px',
              maxWidth: '400px',
              width: '90%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#00bcd4', margin: 0 }}>회원가입</h2>
              <button
                onClick={() => {
                  setShowSignUpModal(false);
                  setSignUpError("");
                  setSignUpSuccess(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ccc',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
            <div className="signup-form">
              <input
                type="text"
                placeholder="이메일 또는 아이디"
                id="signup-email"
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(26, 26, 46, 0.6)',
                  color: '#f2f2f2',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <input
                type="password"
                placeholder="비밀번호 (최소 6자)"
                id="signup-password"
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(26, 26, 46, 0.6)',
                  color: '#f2f2f2',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {signUpSuccess && (
                <div style={{
                  padding: '15px',
                  marginBottom: '15px',
                  borderRadius: '8px',
                  background: 'rgba(76, 175, 80, 0.2)',
                  border: '1px solid rgba(76, 175, 80, 0.5)',
                  color: '#4caf50',
                  fontSize: '14px',
                  textAlign: 'center',
                  fontWeight: '500'
                }}>
                  ✅ 회원가입이 완료되었습니다! 로그인해주세요.
                </div>
              )}
              {signUpError && (
                <div style={{
                  padding: '10px',
                  marginBottom: '15px',
                  borderRadius: '8px',
                  background: 'rgba(244, 67, 54, 0.2)',
                  border: '1px solid rgba(244, 67, 54, 0.5)',
                  color: '#ff6b6b',
                  fontSize: '13px',
                  textAlign: 'center'
                }}>
                  {signUpError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    const email = document.getElementById("signup-email")?.value || "";
                    const password = document.getElementById("signup-password")?.value || "";
                    if (email && password) {
                      handleSignUp(email, password);
                    } else {
                      setSignUpError("이메일(또는 아이디)와 비밀번호를 모두 입력해주세요.");
                    }
                  }} 
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  회원가입
                </button>
                <button 
                  onClick={() => {
                    setShowSignUpModal(false);
                    setSignUpError("");
                    setSignUpSuccess(false);
                  }} 
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#ccc',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '14px'
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
