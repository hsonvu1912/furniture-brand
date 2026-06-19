// =============================================================================
// Brand token "ngăn" (P82) — MỌI chỗ chữ thương hiệu "ngăn" xuất hiện trong UI đều
// render bằng font Lora (serif) + chữ thường. `normal-case` đè các nhãn bị CSS ép
// in-hoa (editorial-caption, nav heading) để "ngăn" luôn viết thường. Màu kế thừa
// từ context (không ép màu). Dùng: <Ngan /> trong văn bản, hoặc <Ngan className="..."/>.
// =============================================================================
export function Ngan({ className = "" }: { className?: string }) {
  // not-italic: nhiều tiêu đề có display-italic → "ngăn" sẽ bị nghiêng theo, trông khác
  // logo (Lora đứng). Ép đứng để mọi chỗ "ngăn" nhất quán như logo. normal-case: đè
  // các nhãn in-hoa để "ngăn" luôn thường.
  return <span className={`font-lora normal-case not-italic ${className}`}>ngăn</span>;
}
