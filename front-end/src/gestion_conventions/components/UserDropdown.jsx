// src/components/UserDropdown/UserDropdown.js
import React from 'react';
import './headers.css';
// import { useNavigate } from 'react-router-dom';

// Remove onLogout from props if it's no longer passed or needed inside
const UserDropdown = React.forwardRef(({ currentUser, closeDropdown }, ref) => {
  // const navigate = useNavigate();

  const handleProfileClick = () => {
    console.log("Trigger: Navigate to Profile");
    // navigate('/profile');
    closeDropdown();
  };

  const handleSettingsClick = () => {
    console.log("Trigger: Navigate to Account Settings");
    // navigate('/settings');
    closeDropdown();
  };

  // handleLogoutClick function is removed

  return (
    <div className="user-dropdown" ref={ref}>

      {/* User Info Section */}
      {currentUser ? (
        <div className="user-info-section">
          <div className="user-name" title={currentUser.name}>
            {currentUser.name || 'User'}
          </div>
          <div className="user-role">
            {currentUser.role || 'Member'}
          </div>
        </div>
      ) : (
        <div className="user-info-section">
            <div className="user-name">Loading...</div>
        </div>
      )}

      {/* Separator between info and actions */}
      {/* Only show separator if there are actions below */}
      <hr className="dropdown-separator" />

      {/* Action Items */}
      <ul>
        <li onClick={handleProfileClick}>View Profile</li>
        <li onClick={handleSettingsClick}>Account Settings</li>
        {/* Logout list item removed */}
        {/* Separator list item removed */}
      </ul>
    </div>
  );
});

export default UserDropdown;