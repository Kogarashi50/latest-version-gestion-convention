// src/gestion_conventions/components/headers.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserCircle,
  faSignOutAlt,
  faSpinner,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import './Header.css';

// *** REMOVED Role Mapping ***

// *** CHANGE: Accepts currentUser from App.js ***
export default function Header({ onLogout, currentUser }) { // Added currentUser prop
  const [isUserInfoVisible, setIsUserInfoVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileRef = useRef(null);

  // *** REMOVED getUser function and related state (isLoadingUser, fetchError) - data now passed via prop ***

  // --- Effect Hook: Handle Clicks Outside --- (Remains the same)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsUserInfoVisible(false);
      }
    };
    if (isUserInfoVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserInfoVisible]);

  const toggleUserInfo = () => {
    setIsUserInfoVisible(prev => !prev);
  };

  // --- Logout Handler --- (Remains mostly the same, relies on parent onLogout)
   const handleLogoutClick = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      console.error("HEADER: Error during onLogout:", error);
    } finally {
      setIsLoggingOut(false); // Reset state even on error
    }
  };
  // ---

  return (
    <header className="main-content-header">
      <div className="header-actions">
        <div className="user-profile-section" ref={profileRef}>
          <span
            onClick={toggleUserInfo}
            className="icon-placeholder user-icon-container"
            title="Profile" role="button" aria-haspopup="true"
            aria-expanded={isUserInfoVisible} tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleUserInfo()}
           >
            <FontAwesomeIcon icon={faUserCircle} className="header-icon" />
          </span>

          {isUserInfoVisible && (
    <div className="user-info-popup" role="menu">
      {currentUser ? (
        <>
          {/* *** CHANGE: Display nom_complet, fallback to email *** */}
          <div className="user-info-item user-info-name" role="menuitem" title={currentUser.nom_complet || currentUser.email}>
             {currentUser.nom_complet || currentUser.email}
          </div>
          {/* You could add email or status below if needed */}
          {/* <div className="user-info-item user-info-role" role="menuitem">
              {currentUser.email}
          </div> */}
        </>
      ) : (
        // Loading state
        <div className="user-info-item loading-indicator" role="menuitem">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span style={{ marginLeft: '8px' }}>Chargement...</span>
        </div>
      )}
    </div>
  )}
        </div>

        {/* Logout Icon Section (Remains the same) */}
        <span
          onClick={handleLogoutClick}
          className={`icon-placeholder logout-icon-container ${isLoggingOut ? 'disabled' : ''}`}
          title={isLoggingOut ? "Déconnexion en cours..." : "Déconnexion"}
          role="button" aria-disabled={isLoggingOut} tabIndex={isLoggingOut ? -1 : 0}
          onKeyDown={(e) => !isLoggingOut && (e.key === 'Enter' || e.key === ' ') && handleLogoutClick()}
        >
          {isLoggingOut ? <FontAwesomeIcon icon={faSpinner} spin className="header-icon" /> : <FontAwesomeIcon icon={faSignOutAlt} className="header-icon" />}
        </span>
      </div>
    </header>
  );
}

// Define default props for robustness
Header.defaultProps = {
  currentUser: null, // Default to null if no user data passed
  onLogout: async () => { console.warn('Header: onLogout prop missing.'); },
};