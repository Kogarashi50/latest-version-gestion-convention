// src/gestion_conventions/components/sidebar.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import menuItems, { faChevronDown, PERMISSIONS } from "../data"; // Import PERMISSIONS
import "./dashboard.css"; // Main dashboard styles (if any)

const EXCLUDED_ITEM_ID = 1; // ID for Brand/Logo item
const COLLAPSE_THRESHOLD_WIDTH = 100; // Adjust if your collapsed width changes

const Sidebar = ({ currentUser }) => {
    const [activeItemId, setActiveItemId] = useState(null);
    const [selectorStyle, setSelectorStyle] = useState({ opacity: 0, top: 0, height: 0 });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedItems, setExpandedItems] = useState({}); // State for expanded parents { parentId: true }
    const sidebarRef = useRef(null);
    const itemRefs = useRef({});
    const location = useLocation();
    const resizeObserverRef = useRef(null);

    const userPermissions = currentUser?.permissions || [];

    // --- Helper Functions ---
    const getSubtitles = useCallback((parentId) => {
        return menuItems.filter(item => item.type === 'subtitle' && item.parentId === parentId);
    }, []);

    // --- handleItemClick: Handles collapsing others ---
    const handleItemClick = useCallback((item, event) => {
        console.log("[Sidebar] Clicked item:", item.label, "ID:", item.id);

        if (item.type === 'heading') {
            event.preventDefault();
            return;
        }

        // --- Expansion Logic: Collapse others ---
        let nextExpandedState = {}; // Start with empty state (collapse all)

        if (item.hasSubtitles) {
            // Clicked on a parent item itself. Keep *only* this one expanded.
            // Even if it was already expanded, setting it ensures others are collapsed.
            nextExpandedState = { [item.id]: true };
            // Prevent default navigation if it's just an expander link
            if (item.path === '#') {
                event.preventDefault();
            }
        } else if (item.type === 'subtitle' && item.parentId) {
            // Clicked on a subtitle. Keep *only* its parent expanded.
            nextExpandedState = { [item.parentId]: true };
        }
        // If it's a regular item (no subtitles, not a subtitle itself),
        // nextExpandedState remains {}, collapsing all dropdowns.

        // Update the expanded items state
        setExpandedItems(nextExpandedState);
        // --- End Expansion Logic ---


        // --- Active Item Logic ---
        // Update active item ID (only for actual links, not pure expanders '#')
        if (item.path !== '#' && item.id !== EXCLUDED_ITEM_ID) {
             setActiveItemId(item.id);
        } else if (item.id === EXCLUDED_ITEM_ID) {
             // Optional: Clear active state if logo is clicked
             // setActiveItemId(null);
        }
        // --- End Active Item Logic ---


        // --- Scrolling Logic (remains the same) ---
        const itemElement = itemRefs.current[item.id];
        const sidebarElement = sidebarRef.current;

        if (itemElement && sidebarElement) {
            setTimeout(() => {
                const currentItemElement = itemRefs.current[item.id];
                const currentSidebarElement = sidebarRef.current;
                if (!currentItemElement || !currentSidebarElement) {
                    console.warn("[Sidebar] Refs became invalid before scroll timeout.");
                    return;
                }
                currentItemElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }, 0);
        } else {
            console.warn("[Sidebar] Scrolling skipped: itemElement or sidebarElement ref not found immediately on click.");
        }
        // --- End Scrolling Logic ---

    }, [/* No dependencies needed for state setters */]); // Removed toggleExpand dependency


    // --- updateSelector (calculates style for the active item highlight) ---
    const updateSelector = useCallback((itemId, currentCollapsedState) => {
        const activeItem = menuItems.find(i => i.id === itemId);
        if (!activeItem || activeItem.type === 'heading' || currentCollapsedState) {
            setSelectorStyle(prev => prev.opacity === 0 ? prev : { ...prev, opacity: 0 });
            return;
        }
        const activeItemElement = itemRefs.current[itemId];
        if (activeItemElement && activeItemElement.offsetHeight > 0 && sidebarRef.current) {
            const topRelativeToSidebar = activeItemElement.offsetTop;
            const newStyle = {
                top: `${topRelativeToSidebar}px`,
                height: `${activeItemElement.offsetHeight}px`,
                opacity: 1,
            };
            setSelectorStyle(prev => (prev.top === newStyle.top && prev.height === newStyle.height && prev.opacity === newStyle.opacity) ? prev : newStyle);
        } else {
            setSelectorStyle(prev => prev.opacity === 0 ? prev : { ...prev, opacity: 0 });
        }
    }, []);

    // --- getItemLabel (extracts text label for tooltips etc.) ---
    const getItemLabel = (label) => {
         // Your existing logic here
         if (typeof label === 'string') return label;
         if (React.isValidElement(label) && label.props?.children?.find) {
             const textSpan = label.props.children.find(child => child?.props?.className === 'brand-text');
             if (textSpan && typeof textSpan.props.children === 'string') { return textSpan.props.children.replace('<br />', ' '); }
         }
         if (React.isValidElement(label) && typeof label.props.children === 'string') { return label.props.children; }
         if (React.isValidElement(label) && label.type === 'span' && label.props?.children?.[0]?.type === 'img') {
             const textSpan = label.props.children.find(child => child?.props?.className === 'brand-text');
             return textSpan?.props?.children?.[0] || "Accueil";
         }
         return "Menu Item";
    };


    // --- useEffect Hooks ---

    // Update active item and expand parent based on URL location
    useEffect(() => {
        const currentPath = location.pathname;
        let potentialActiveId = null;
        let isSubActive = false;
        let activeParentId = null;
        const activeItem = menuItems.find(item => item && item.path === currentPath && item.type !== 'heading');

        if (activeItem) {
            potentialActiveId = activeItem.id;
            if (activeItem.type === 'subtitle' && activeItem.parentId) {
                 isSubActive = true;
                 activeParentId = activeItem.parentId;
            }
        }
        const finalActiveId = (potentialActiveId !== null && potentialActiveId !== EXCLUDED_ITEM_ID) ? potentialActiveId : null;
        setActiveItemId(prevId => prevId === finalActiveId ? prevId : finalActiveId);

        // Expand the parent when navigating directly to a subtitle URL
        if (isSubActive && activeParentId) {
             // Set expanded state to *only* the active parent
             setExpandedItems({ [activeParentId]: true });
        } else if (!isSubActive && finalActiveId && !menuItems.find(i => i.id === finalActiveId)?.hasSubtitles) {
             // If navigating to a non-parent, non-subtitle item, collapse all
             // setExpandedItems({}); // Optional: uncomment if direct nav should collapse others
        }

    }, [location.pathname]);

    // Handle sidebar collapse/expand based on width (remains the same)
    useEffect(() => {
        const sidebarElement = sidebarRef.current;
        if (!sidebarElement) return;
        let resizeTimeout;
        const observerCallback = entries => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            for (let entry of entries) {
              const currentWidth = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
              const shouldBeCollapsed = currentWidth < COLLAPSE_THRESHOLD_WIDTH;
              setIsCollapsed(prev => prev === shouldBeCollapsed ? prev : shouldBeCollapsed);
            }
          }, 50);
        };
        if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); }
        resizeObserverRef.current = new ResizeObserver(observerCallback);
        resizeObserverRef.current.observe(sidebarElement);
        const initialWidth = sidebarElement.getBoundingClientRect().width;
        setIsCollapsed(initialWidth < COLLAPSE_THRESHOLD_WIDTH);
        return () => {
            clearTimeout(resizeTimeout);
            if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
        };
      }, []);

    // Update the selector position (remains the same)
    useEffect(() => {
        const animationFrameId = requestAnimationFrame(() => {
          updateSelector(activeItemId, isCollapsed);
        });
        return () => cancelAnimationFrame(animationFrameId);
      }, [activeItemId, isCollapsed, updateSelector]);


    // --- Filtering Logic --- (Remains the same)
    const finalVisibleMenuItems = useMemo(() => {
        const permissionFilteredItems = menuItems.filter(item => {
            if (item.type === 'heading' || !item.requiredPermission || item.id === EXCLUDED_ITEM_ID) return true;
            return userPermissions.includes(item.requiredPermission);
        });
        const visibleFunctionalItemIds = new Set(
            permissionFilteredItems
                .filter(item => item.type !== 'heading' && item.id !== EXCLUDED_ITEM_ID)
                .map(item => item.id)
        );
        permissionFilteredItems.forEach(item => {
            if(item.type === 'subtitle' && item.parentId && visibleFunctionalItemIds.has(item.id)) {
                 const parentItem = menuItems.find(p => p.id === item.parentId);
                 if(parentItem && (!parentItem.requiredPermission || userPermissions.includes(parentItem.requiredPermission))) {
                      if(!visibleFunctionalItemIds.has(item.parentId)) {
                           visibleFunctionalItemIds.add(item.parentId);
                      }
                 }
            }
        });
        const result = menuItems.filter((item, index, allItems) => {
            if (item.id === EXCLUDED_ITEM_ID) return true;
            if (item.type !== 'heading') return visibleFunctionalItemIds.has(item.id);
            if (item.type === 'heading') {
                let hasVisibleChild = false;
                for (let i = index + 1; i < allItems.length; i++) {
                    const nextItem = allItems[i];
                    if (nextItem.type === 'heading') break;
                    if (visibleFunctionalItemIds.has(nextItem.id)) {
                         hasVisibleChild = true; break;
                    }
                }
                return hasVisibleChild;
            }
            return false;
        });
        return result;
    }, [userPermissions, getSubtitles]);


    // --- Render Function for a single menu item ---
    const renderMenuItem = (item) => {
        if (!item || typeof item.id === 'undefined') return null;

        // --- RENDER HEADING ---
        if (item.type === 'heading') {
            if (isCollapsed) return null;
            return ( <li key={item.id} className="sidebar-section-heading "><div className="sidebar-hr"><hr /></div><span style={{ paddingLeft:'25px'}}>{item.label}</span></li> );
        }

        // --- RENDER OTHER ITEMS ---
        const titleLabel = getItemLabel(item.label);
        const isActive = activeItemId === item.id;
        const isSubtitle = item.type === 'subtitle';
        const isParent = item.hasSubtitles;
        // Determine if this specific parent item should be expanded based on the state
        const isEffectivelyExpanded = isParent && expandedItems[item.id]; // Direct check

        const liClasses = [
            isActive ? "active" : "",
            isSubtitle ? "sidebar-subtitle" : "",
            isParent ? "sidebar-expandable" : "",
            isEffectivelyExpanded ? "expanded" : "", // Use direct check for 'expanded' class
            item.id === EXCLUDED_ITEM_ID ? "brand-item" : "",
        ].filter(Boolean).join(" ");

        // Ref Assignment (remains the same)
        const assignRef = (el) => {
             if (el && item.id !== EXCLUDED_ITEM_ID && item.type !== 'heading') {
                 itemRefs.current[item.id] = el;
             } else {
                 if (itemRefs.current[item.id]) {
                     delete itemRefs.current[item.id];
                 }
             }
         };

        return (
            <React.Fragment key={item.id}>
                <li ref={assignRef} className={liClasses} aria-expanded={isParent ? isEffectivelyExpanded : undefined} >
                    <Link
                        to={item.path}
                        title={isCollapsed ? titleLabel || undefined : undefined}
                        onClick={(e) => handleItemClick(item, e)} // This now handles expansion logic
                        aria-current={isActive ? "page" : undefined}
                    >
                        {/* Icon */}
                        {item.id === EXCLUDED_ITEM_ID ? (
                            <span style={{marginTop:'15px'}} className="d-flex justify-self-center align-items-center text-center mainItem">
                                <img src="/logosite.png" className="align-self-center bg-light Navlogo" width="50" height="50" alt="Logo" style={{ transition: 'width 0.3s ease, height 0.3s ease' ,padding:'4px'}} />
                                {!isCollapsed && (
                                    <span className="brand-text text-start"> GICOPMA <small className="d-block " style={{fontSize:'8px'}}>GESTION INTEGREE DES CONVENTIONS,<br/>PROJETS ET MARCHES</small> </span>
                                )}
                            </span>
                         ) : item.icon ? (
                            <FontAwesomeIcon icon={item.icon} fixedWidth />
                         ) : (
                             isCollapsed && <span style={{display: 'inline-block', width: '1.25em'}}></span> // Placeholder
                         )}

                        {/* Label and Arrow */}
                        {!isCollapsed && item.id !== EXCLUDED_ITEM_ID && (
                            <span className="sidebar-item-label">
                                {item.label}
                                {isParent && (
                                    // Arrow rotation based on whether this item is expanded
                                    <FontAwesomeIcon icon={faChevronDown} className={`expand-arrow ${isEffectivelyExpanded ? 'rotated' : ''}`} />
                                )}
                            </span>
                        )}
                    </Link>
                </li>

                {/* Render Subtitles Conditionally: Check if this parent is expanded */}
                {isParent && isEffectivelyExpanded && !isCollapsed && (
                    <ul className="sidebar-submenu">
                        {getSubtitles(item.id)
                            .filter(subItem => finalVisibleMenuItems.some(visible => visible.id === subItem.id))
                            .map(renderMenuItem)}
                    </ul>
                )}
            </React.Fragment>
        );
    }; // End renderMenuItem

    // --- Component Return ---
    return (
        <ul className={`sidebar ${isCollapsed ? 'is-collapsed' : ''}`} ref={sidebarRef}>
            <div className="selector-active" style={selectorStyle}>
                 <div className="top"></div><div className="bottom"></div>
            </div>
            {finalVisibleMenuItems
                .filter(item => item.type !== 'subtitle')
                .map(renderMenuItem)}
        </ul>
    );
};

// PropTypes
Sidebar.propTypes = {
    currentUser: PropTypes.shape({
        permissions: PropTypes.arrayOf(PropTypes.string)
    })
};

export default Sidebar;