import { h } from 'preact';
import { useState } from 'preact/hooks'
import htm from 'htm';
import editor from './editor';

import './app.css'

const html = htm.bind(h);

export function App() {
  const [count, setCount] = useState(0)

  setTimeout(function(){
    editor();
  }, 2000)

  return (
    html `<div id="topnav">
      <div class="nav-wrapper">
        <button id="collapse">Collapse</button>
        <button id="scale-down">-</button>
        <button id="scale-up">+</button>
        <button>Save</button>
      </div>
    </div>
    <div id="app"></div>`
  )
}
