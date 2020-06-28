import React from 'react'
import ReactDOM from 'react-dom'
import * as serviceWorker from './serviceWorker'
// Main component
import Main from "./Main.js"
import App from './App';

App.LoadCssFile('./css/dark.css');

// Init app 
ReactDOM.render(
    <Main />,
    document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()