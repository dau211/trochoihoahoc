
import { GoogleGenAI, Type } from "@google/genai";
import { Question, GameMode } from "../types";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 2000; // 2 seconds

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateQuestions = async (topic: string, mode: GameMode): Promise<Question[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let promptContext = "";
  let questionCount = 15;

  if (mode === 'MILLIONAIRE') {
    promptContext = `
    CẤU TRÚC GAME "AI LÀ TRIỆU PHÚ" (15 CÂU):
    - Câu 1-5: Mức độ Nhận biết (Rất dễ, kiến thức cơ bản).
    - Câu 6-10: Mức độ Thông hiểu (Trung bình, yêu cầu hiểu bản chất).
    - Câu 11-15: Mức độ Vận dụng (Khó, yêu cầu suy luận, tính toán nhỏ hoặc kiến thức tổng hợp).
    - Các câu hỏi cần có độ dài vừa phải, đáp án gây nhiễu hợp lý.
    `;
    questionCount = 15;
  } else {
    promptContext = `
    CẤU TRÚC GAME "ĐƯỜNG LÊN ĐỈNH OLYMPIA - PHẦN KHỞI ĐỘNG" (20 CÂU):
    - Tạo ra 20 câu hỏi.
    - ĐẶC ĐIỂM QUAN TRỌNG: Câu hỏi phải NGẮN GỌN, SÚC TÍCH, ĐỌC NHANH (1-2 dòng).
    - Mức độ: Trải dài từ Nhận biết đến Thông hiểu. Không cho câu hỏi tính toán phức tạp mất thời gian.
    - Tập trung vào lý thuyết, tính chất, ứng dụng, công thức hóa học cơ bản.
    `;
    questionCount = 20;
  }

  const prompt = `
    Bạn là hệ thống hỗ trợ Hóa học dành cho học sinh THPT Việt Nam, bám sát Chương trình Giáo dục Phổ thông 2018.
    Nhiệm vụ: Tạo bộ câu hỏi trắc nghiệm về chủ đề: "${topic}".

    QUY TẮC NGHIÊM NGẶT VỀ DANH PHÁP HÓA HỌC (BẮT BUỘC):
    1. Tên chất: PHẢI dùng tiếng Anh chuẩn IUPAC (ví dụ: Sodium chloride, Sulfuric acid). KHÔNG dùng tên tiếng Việt (như Natri clorua).
    2. Công thức hóa học:
       - Viết liền, chuẩn xác (ví dụ: H2SO4, C2H5OH).
       - Ion: Viết liền kèm điện tích (ví dụ: Fe3+, Cu2+, SO4 2-, NO3-). KHÔNG dùng ký hiệu lạ.
       - Isotopes (Đồng vị): Viết số khối trước (ví dụ: 12C, 14C) hoặc dùng tên (Carbon-14).
    3. Ngôn ngữ còn lại: Tiếng Việt.

    QUY TẮC PHÂN TÍCH HIỂN THỊ (Frontend Parser Rules):
    - Hệ thống sẽ tự động chuyển các số trong công thức (ví dụ H2O) thành chỉ số dưới (subscript).
    - Hệ thống sẽ tự động chuyển điện tích ion (ví dụ 3+, 2-) thành chỉ số trên (superscript) nếu chúng nằm ở cuối công thức.
    => VÌ VẬY: Hãy viết công thức hóa học ở dạng văn bản thuần túy chuẩn xác nhất. Ví dụ: Viết "Fe2(SO4)3" thay vì cố gắng format.

    PHẠM VI KIẾN THỨC:
    – Chỉ sử dụng kiến thức Hóa học THPT lớp 10, 11, 12 thuộc CTGD 2018 và các bộ sách: Cánh Diều, Kết Nối Tri Thức, Chân Trời Sáng Tạo.
    – Không sử dụng kiến thức cũ đã bị loại bỏ trong chương trình 2018 (khái niệm cũ, đơn vị cũ, phương pháp cũ…).

    ${promptContext}

    Định dạng đầu ra: JSON Array gồm ${questionCount} object câu hỏi.
  `;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "Nội dung câu hỏi bằng Tiếng Việt (tên chất tiếng Anh/Công thức chuẩn)" },
          answers: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Danh sách 4 đáp án (tên chất tiếng Anh/Công thức chuẩn)"
          },
          correctIndex: { 
            type: Type.INTEGER, 
            description: "Chỉ số của đáp án đúng (0-3)" 
          },
          explanation: { 
            type: Type.STRING, 
            description: "Lời giải thích ngắn gọn, đi thẳng vào kiến thức khoa học, giải thích tại sao đáp án đó là đúng hoặc sai. TUYỆT ĐỐI KHÔNG sử dụng các từ cảm thán như 'Chúc mừng', 'Xuất sắc', 'Rất tiếc', 'Hoan hô', 'Tuyệt vời'. Chỉ cung cấp thông tin Hóa học thuần túy." 
          }
        },
        required: ["question", "answers", "correctIndex"]
      }
    }
  };

  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: config
      });

      if (response.text) {
        const questions = JSON.parse(response.text) as Question[];
        if (Array.isArray(questions) && questions.length > 0) {
          return questions;
        }
      }
      throw new Error("Invalid response format from AI");
    } catch (error: any) {
      // Handle Rate Limits (429) or Service Unavailable (503)
      const isQuotaError = error.message?.includes("429") || 
                           error.status === 429 || 
                           error.code === 429 ||
                           error.message?.includes("RESOURCE_EXHAUSTED");
      
      if (isQuotaError && attempts < MAX_RETRIES - 1) {
        attempts++;
        // Backoff: 2s, 4s, 8s
        const waitTime = INITIAL_BACKOFF * Math.pow(2, attempts - 1);
        console.warn(`Gemini API Quota Exceeded. Retrying in ${waitTime}ms... (Attempt ${attempts}/${MAX_RETRIES})`);
        await delay(waitTime);
        continue;
      }
      
      console.error("Error generating questions:", error);
      throw error;
    }
  }
  
  throw new Error("Failed to generate questions after multiple retries due to rate limits.");
};
