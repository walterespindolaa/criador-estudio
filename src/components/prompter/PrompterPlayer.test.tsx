import { render, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PrompterPlayer } from "./PrompterPlayer";

describe("teleprompter (montagem e controles)", () => {
  it("monta, pausa, pula cena, muda velocidade e sai", async () => {
    vi.useFakeTimers();
    const onExit = vi.fn();
    const txt = "Cena 1:\nOlá pessoal tudo bem\n[close no rosto]\n\nCena 2:\nSegunda parte do **roteiro** aqui [pausa] fim";
    render(<PrompterPlayer title="t" text={txt} onExit={onExit} />);
    const root = document.querySelector(".cpr")!;
    expect(root).toBeTruthy();
    expect(root.querySelectorAll(".scene").length).toBe(2);
    expect(root.querySelectorAll(".dir").length).toBe(1);
    expect(root.querySelectorAll("#prompterText .w").length).toBe(10);
    fireEvent.click(root.querySelector("#spUp")!);
    expect(root.querySelector("#spVal")!.textContent).toBe("150");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(root.querySelector("#spVal")!.textContent).toBe("140");
    fireEvent.click(root.querySelector("#playBtn")!); // contagem
    expect((root.querySelector("#countdown") as HTMLElement).style.display).toBe("flex");
    fireEvent.click(root.querySelector("#countdown")!); // cancela
    expect((root.querySelector("#countdown") as HTMLElement).style.display).toBe("none");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
