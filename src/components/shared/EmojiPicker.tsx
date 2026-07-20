import { useState } from "react";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* Seletor de emoji leve (sem lib externa): uma grade curada por categoria,
   com os emojis que mais aparecem em legenda de rede social. Insere no cursor. */
const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Rostos",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🫡 😐 😶 🙄 😏 😣 😥 😮 😪 😴 🤤 😔 😕 🙁 ☹️ 😖 😞 😟 😤 😢 😭 😨 😩 🤯 😬 😰 😱 🥵 🥶 😳 🥳 🥺 😡 😠 🤬 😷 🤒 🤕 🤢 🤮 🥴 😵 🤠".split(" "),
  },
  {
    label: "Gestos",
    emojis: "👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🙏 ✍️ 💪 🫶 🤝 👋 🤙 ✌️ 🤞 🫰 🤟 🤘 👌 🤌 🤏 👆 👇 👈 👉 ☝️ ✋ 🤚 🖐️ 🖖 👀 👁️".split(" "),
  },
  {
    label: "Corações",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝".split(" "),
  },
  {
    label: "Símbolos",
    emojis: "✨ ⭐ 🌟 💫 🔥 💥 💯 ✅ ❌ ⚡ 🎉 🎊 🚀 💡 📌 📍 ⏰ 🔔 🏷️ 🔖 ➡️ ⬅️ ⬆️ ⬇️ ➕ ➖ ✔️ ❓ ❗".split(" "),
  },
  {
    label: "Objetos",
    emojis: "📸 🎥 🎬 🎧 🎤 📱 💻 📊 📈 📉 📝 📄 🗒️ 📚 📖 ✏️ 🖊️ 📆 🗓️ 💰 🛒 🎁 🏆 🥇 ☕ 🍿 🌱 🌿 🌎 🌈 💎 🔑 🎯 💬 💭".split(" "),
  },
];

export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Inserir emoji"
          className={cn("grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors", className)}
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] max-h-[320px] overflow-y-auto p-2">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-1.5">
            <p className="px-1 py-1 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/70">{g.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {g.emojis.map((e, i) => (
                <button
                  key={g.label + i}
                  type="button"
                  onClick={() => onPick(e)}
                  className="grid h-8 w-8 place-items-center rounded-md text-lg leading-none hover:bg-muted transition-colors"
                  aria-label={`Inserir ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default EmojiPicker;
