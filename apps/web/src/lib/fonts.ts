import { Plus_Jakarta_Sans } from "next/font/google";

export const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ["latin", "cyrillic-ext", "latin-ext", "vietnamese"],
    weight: ["200", "300", "400", "500", "600", "700", "800"], // Covering the range 200-800 from original css
    variable: "--font-plus-jakarta",
    display: "swap",
});
