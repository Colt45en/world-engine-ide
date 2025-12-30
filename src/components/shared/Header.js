import React from 'react';
import './Header.css';

const Header = () => {
    return (
        <header className="header">
            <h1 className="header-title">World Engine IDE</h1>
            <nav className="header-nav">
                <ul>
                    <li><a href="#dashboard">Dashboard</a></li>
                    <li><a href="#studio">Studio</a></li>
                    <li><a href="#launch">Launch Applications</a></li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;