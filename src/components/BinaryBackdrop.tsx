import { useEffect, useRef } from 'react';

export function BinaryBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let columns: { y: number; speed: number; seed: number }[] = [];
    let frame = 0;
    let last = 0;
    let raf = 0;

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const spacing = width < 720 ? 34 : 26;
      const count = Math.max(8, Math.floor(width / spacing));
      columns = Array.from({ length: count }, (_, index) => ({
        y: Math.random() * height,
        speed: index % 5 === 0 ? 9 : 4 + Math.random() * 4,
        seed: Math.random() * 1000,
      }));
    };

    const drawStatic = () => {
      context.clearRect(0, 0, width, height);
      context.font = '12px "JetBrains Mono", monospace';
      const count = Math.floor((width * height) / 24000);
      for (let i = 0; i < count; i++) {
        const seed = (i * 9301 + 49297) % 233280;
        const x = (seed / 233280) * width;
        const y = ((i * 4919 + 12345) % 233280) / 233280 * height;
        context.fillStyle = i % 7 === 0 ? 'rgba(107, 75, 51, 0.06)' : 'rgba(15, 76, 72, 0.09)';
        context.fillText(i % 2 ? '0' : '1', x, y);
      }
    };

    const step = (time: number) => {
      if (!last) last = time;
      if (time - last < 70) {
        raf = requestAnimationFrame(step);
        return;
      }
      last = time;
      frame += 1;
      context.clearRect(0, 0, width, height);
      context.font = '12px "JetBrains Mono", monospace';
      const spacing = width < 720 ? 34 : 26;
      columns.forEach((column, index) => {
        column.y += column.speed;
        if (column.y > height + 40) {
          column.y = -40;
          column.seed = Math.random() * 1000;
        }
        const x = index * spacing + 8;
        for (let trail = 0; trail < 3; trail++) {
          const y = column.y - trail * 17;
          if (y < -20 || y > height + 20) continue;
          const bit = (Math.floor(column.seed) + frame + index + trail) % 2 === 0 ? '0' : '1';
          context.fillStyle =
            trail === 0 ? 'rgba(15, 76, 72, 0.20)' : trail === 1 ? 'rgba(15, 76, 72, 0.10)' : 'rgba(107, 75, 51, 0.07)';
          context.fillText(bit, x, y);
        }
      });
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) {
        drawStatic();
      } else {
        raf = requestAnimationFrame(step);
      }
    };

    setup();
    start();

    const onResize = () => {
      setup();
      start();
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        start();
      }
    };
    const onMotion = () => start();

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    reduce.addEventListener?.('change', onMotion);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      reduce.removeEventListener?.('change', onMotion);
    };
  }, []);

  return <canvas ref={canvasRef} className="binary-backdrop" aria-hidden="true" />;
}
