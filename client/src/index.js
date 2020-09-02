import React from 'react';
import ReactDOM from 'react-dom';
import './style/index.scss';
import Main from './Main';

if(window.self === window.top){
  document.body.style.display = "block"
} else {
  window.top.location = window.self.location
}

ReactDOM.render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
  document.getElementById('root')
);

