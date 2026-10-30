import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VslPlayer } from "./VslPlayer";

const base = {
  poster: "/py/vsl-portada.webp",
  title: "Video",
  playLabel: "Tocá para ver el video",
  durationLabel: "6 min",
  pendingLabel: "El video se está preparando",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VslPlayer", () => {
  it("muestra la portada y no carga YouTube hasta que se toca", () => {
    render(<VslPlayer {...base} videoId="abc123" />);
    expect(screen.getByRole("button", { name: /Tocá para ver el video/ })).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("al tocar, carga el video de YouTube sin cookies y avisa que empezó", () => {
    const onPlay = vi.fn();
    render(<VslPlayer {...base} videoId="abc123" onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: /Tocá para ver el video/ }));
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toContain("https://www.youtube-nocookie.com/embed/abc123");
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("sin id de video muestra el aviso y tocar no hace nada", () => {
    const onPlay = vi.fn();
    render(<VslPlayer {...base} videoId="" onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: /El video se está preparando/ }));
    expect(document.querySelector("iframe")).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();
  });
});
