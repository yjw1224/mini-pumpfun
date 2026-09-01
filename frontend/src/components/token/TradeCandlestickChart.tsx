"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type UTCTimestamp,
} from "lightweight-charts";
import { type OhlcPoint } from "@/hooks/useTradeHistory";

type TradeCandlestickChartProps = {
  data: OhlcPoint[];
};

export function TradeCandlestickChart({ data }: TradeCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const styles = getComputedStyle(document.documentElement);
    const chart = createChart(container, {
      autoSize: true,
      height: 256,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: styles.getPropertyValue("--color-text-muted").trim(),
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: styles.getPropertyValue("--color-primary").trim(),
      downColor: styles.getPropertyValue("--color-negative").trim(),
      borderUpColor: styles.getPropertyValue("--color-primary").trim(),
      borderDownColor: styles.getPropertyValue("--color-negative").trim(),
      wickUpColor: styles.getPropertyValue("--color-primary").trim(),
      wickDownColor: styles.getPropertyValue("--color-negative").trim(),
      priceFormat: {
        type: "price",
        precision: 6,
        minMove: 0.000001,
      },
    });

    series.setData(data.map((point) => ({ ...point, time: point.time as UTCTimestamp })));
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data]);

  return <div ref={containerRef} className="h-64 w-full" />;
}
