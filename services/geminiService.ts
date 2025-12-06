import { GoogleGenAI, Type } from "@google/genai";
import { Question, GameMode } from "../types";

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
    (Lưu ý: Nếu chủ đề chứa tên chất tiếng Việt, hãy tự động chuyển đổi và sử dụng tên tiếng Anh chuẩn IUPAC trong nội dung câu hỏi).

    QUY TẮC NGHIÊM NGẶT VỀ NGÔN NGỮ:
    – Chỉ tên các chất hóa học được viết bằng tiếng Anh theo chuẩn quốc tế (IUPAC hoặc tên thông dụng quốc tế).
    – Tất cả phần khác (giải thích, mô tả, điều kiện, hiện tượng, nhận xét…) phải viết bằng tiếng Việt.
    – Khi người dùng nhập tên chất bằng tiếng Việt, phải tự động chuyển sang tiếng Anh.
    – Tuyệt đối không sử dụng tên chất bằng tiếng Việt trong bất kỳ hoàn cảnh nào.

    PHẠM VI KIẾN THỨC:
    – Chỉ sử dụng kiến thức Hóa học THPT lớp 10, 11, 12 thuộc CTGD 2018 và các bộ sách: Cánh Diều, Kết Nối Tri Thức, Chân Trời Sáng Tạo.
    – Không sử dụng kiến thức cũ đã bị loại bỏ trong chương trình 2018 (khái niệm cũ, đơn vị cũ, phương pháp cũ…).
    – Không sử dụng nội dung vượt trình độ THPT: cơ chế hữu cơ sâu, hóa lượng tử, phổ IR/NMR, phản ứng bậc cao phức tạp…

    QUY TẮC XỬ LÝ PHẢN ỨNG HÓA HỌC:
    1. Khi viết phương trình, phải dùng công thức hóa học chuẩn và tên chất tiếng Anh.
    2. Phải nêu đúng điều kiện phản ứng theo chương trình THPT 2018 (nhiệt độ, xúc tác, môi trường…).
    3. Phải bảo toàn nguyên tố, hệ số và đảm bảo phản ứng phù hợp với mức THPT.

    ${promptContext}

    Định dạng đầu ra: JSON Array gồm ${questionCount} object câu hỏi.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "Nội dung câu hỏi bằng Tiếng Việt (tên chất tiếng Anh)" },
              answers: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Danh sách 4 đáp án (tên chất tiếng Anh)"
              },
              correctIndex: { 
                type: Type.INTEGER, 
                description: "Chỉ số của đáp án đúng (0-3)" 
              },
              explanation: { type: Type.STRING, description: "Giải thích ngắn gọn bằng Tiếng Việt (tên chất tiếng Anh)" }
            },
            required: ["question", "answers", "correctIndex"]
          }
        }
      }
    });

    if (response.text) {
      const questions = JSON.parse(response.text) as Question[];
      if (Array.isArray(questions) && questions.length > 0) {
        return questions;
      }
    }
    throw new Error("Invalid response format from AI");
  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
};