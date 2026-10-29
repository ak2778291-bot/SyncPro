// src/react-plotly.d.ts
declare module 'react-plotly.js' {
  import Plotly from 'plotly.js';
  import { Component } from 'react';

  interface PlotParams {
    data: Partial<Plotly.PlotData>[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure: Readonly<Plotly.Figure>) => void;
    onUpdate?: (figure: Readonly<Plotly.Figure>) => void;
  }

  export default class Plot extends Component<PlotParams> {}
}
