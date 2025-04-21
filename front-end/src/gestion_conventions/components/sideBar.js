// src/gestion_conventions/components/sidebar.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import menuItems, { faChevronDown, PERMISSIONS } from "../data"; // Import PERMISSIONS
import "./dashboard.css";

const EXCLUDED_ITEM_ID = 1; // ID for Brand/Logo item
const COLLAPSE_THRESHOLD_WIDTH = 100;

const Sidebar = ({ currentUser }) => {
    const [activeItemId, setActiveItemId] = useState(null);
    const [selectorStyle, setSelectorStyle] = useState({ opacity: 0, top: 0, height: 0 });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedItems, setExpandedItems] = useState({});
    const sidebarRef = useRef(null);
    const itemRefs = useRef({});
    const location = useLocation();
    const resizeObserverRef = useRef(null);

    // console.log("[Sidebar] Received currentUser prop:", currentUser); // Debug log

    const userPermissions = currentUser?.permissions || [];
    // console.log("[Sidebar] Extracted userPermissions:", userPermissions); // Debug log

    // --- Helper Functions ---
    const getSubtitles = useCallback((parentId) => {
        return menuItems.filter(item => item.type === 'subtitle' && item.parentId === parentId);
    }, []);

    const toggleExpand = useCallback((itemId) => {
        setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    }, []);

    const handleItemClick = useCallback((item, event) => {
        if (item.type === 'heading') { event.preventDefault(); return; }
        if (item.hasSubtitles) { if (item.path === '#') { event.preventDefault(); } toggleExpand(item.id); }
    }, [toggleExpand]);

    const updateSelector = useCallback((itemId, currentCollapsedState) => {
        // --- Ignore headings for selector ---
        const activeItem = menuItems.find(i => i.id === itemId);
        if (!activeItem || activeItem.type === 'heading') {
            setSelectorStyle(prev => prev.opacity === 0 ? prev : { ...prev, opacity: 0 });
            return;
        }
    
        const activeItemElement = itemRefs.current[itemId];
        if (!currentCollapsedState && activeItemElement && activeItemElement.offsetHeight > 0) {
          const newStyle = {
            top: `${activeItemElement.offsetTop}px`,
            height: `${activeItemElement.offsetHeight}px`,
            opacity: 1,
          };
          setSelectorStyle(newStyle);
        } else {
          setSelectorStyle(prev => prev.opacity === 0 ? prev : { ...prev, opacity: 0 });
        }
      }, []);
      const getItemLabel = (label) => {
        // ... (keep existing logic, it should work fine) ...
         if (typeof label === 'string') return label;
         if (React.isValidElement(label) && label.props?.children?.find) {
             const textSpan = label.props.children.find(child => child?.props?.className === 'brand-text');
             if (textSpan && typeof textSpan.props.children === 'string') { return textSpan.props.children.replace('<br />', ' '); }
         }
         if (React.isValidElement(label) && typeof label.props.children === 'string') { return label.props.children; }
         if (label?.type === 'span' && label?.props?.children?.[0]?.type === 'img') return "Accueil"; // Assuming brand text
         return null;
      };
    
    
    // --- useEffect Hooks --- (Unchanged)
    useEffect(() => {
        const currentPath = location.pathname;
        let potentialActiveId = null;
        let isSubActive = false;
        let activeParentId = null;
    
        // Now searches the single menuItems array
        const activeItem = menuItems.find(item => item && item.path === currentPath && item.type !== 'heading'); // <<< Ignore headings
    
        if (activeItem) {
            potentialActiveId = activeItem.id;
            if (activeItem.type === 'subtitle' && activeItem.parentId) {
                 isSubActive = true;
                 activeParentId = activeItem.parentId;
             }
        }
    
        const finalActiveId = (potentialActiveId !== null && potentialActiveId !== EXCLUDED_ITEM_ID) ? potentialActiveId : null;
        setActiveItemId(prevId => prevId === finalActiveId ? prevId : finalActiveId);
    
        if (isSubActive && activeParentId) {
             setExpandedItems(prev => ({ ...prev, [activeParentId]: true }));
        }
    
      }, [location.pathname]); // Dependency array is okay
    
      useEffect(() => {
        const sidebarElement = sidebarRef.current;
        if (!sidebarElement) return;
        if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); }
        resizeObserverRef.current = new ResizeObserver(entries => {
          for (let entry of entries) {
            const currentWidth = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
            // Simplified collapse logic (adjust threshold as needed)
            const shouldBeCollapsed = currentWidth < COLLAPSE_THRESHOLD_WIDTH;
            setIsCollapsed(prev => prev === shouldBeCollapsed ? prev : shouldBeCollapsed); // Update only if changed
          }
        });
        resizeObserverRef.current.observe(sidebarElement);
        const initialWidth = sidebarElement.getBoundingClientRect().width;
        setIsCollapsed(initialWidth < COLLAPSE_THRESHOLD_WIDTH);
        return () => { if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; } };
      }, []);
    
      useEffect(() => {
        const animationFrameId = requestAnimationFrame(() => {
          updateSelector(activeItemId, isCollapsed);
        });
        return () => cancelAnimationFrame(animationFrameId);
      }, [activeItemId, isCollapsed, updateSelector]);
    
     
    
    // --- Filtering Logic with Heading Visibility Check ---
    const finalVisibleMenuItems = useMemo(() => {
        // console.log("[Sidebar] Recalculating visible menu items...");
        // Step 1: Initial filter based on item permissions
        const permissionFilteredItems = menuItems.filter(item => {
            if (item.type === 'heading' || !item.requiredPermission || item.id === EXCLUDED_ITEM_ID) return true;
            return userPermissions.includes(item.requiredPermission);
        });

        // Step 2: Create Set of visible functional item IDs (includes items + subtitles)
        const visibleFunctionalItemIds = new Set(
            permissionFilteredItems
                .filter(item => item.type !== 'heading' && item.id !== EXCLUDED_ITEM_ID)
                .map(item => item.id)
        );
        // Add parent IDs if a subtitle is visible but parent might not have explicit perm check
        permissionFilteredItems.forEach(item => {
            if(item.type === 'subtitle' && item.parentId && visibleFunctionalItemIds.has(item.id)) {
                 if(!visibleFunctionalItemIds.has(item.parentId)) {
                     // Check if parent *itself* should be visible based on its own permissions
                     const parentItem = menuItems.find(p => p.id === item.parentId);
                     if(parentItem && (!parentItem.requiredPermission || userPermissions.includes(parentItem.requiredPermission))) {
                          visibleFunctionalItemIds.add(item.parentId);
                     }
                 }
            }
        });

        // Step 3: Filter original list, checking heading viability
        const result = menuItems.filter((item, index, allItems) => {
            if (item.id === EXCLUDED_ITEM_ID) return true;
            if (item.type !== 'heading') return visibleFunctionalItemIds.has(item.id);
            // Check heading
            if (item.type === 'heading') {
                let hasVisibleChild = false;
                for (let i = index + 1; i < allItems.length; i++) {
                    const nextItem = allItems[i];
                    if (nextItem.type === 'heading') break;
                    if (visibleFunctionalItemIds.has(nextItem.id)) { hasVisibleChild = true; break; }
                    // Check if subtitles of a visible parent under this heading exist
                    if (nextItem.hasSubtitles && visibleFunctionalItemIds.has(nextItem.id)) {
                         const subtitles = getSubtitles(nextItem.id);
                         // Check if any subtitle itself has permission (less common check)
                         if (subtitles.some(sub => !sub.requiredPermission || userPermissions.includes(sub.requiredPermission))) {
                             hasVisibleChild = true; break;
                         }
                    }
                }
                return hasVisibleChild;
            }
            return false;
        });
        // console.log("[Sidebar] Final Visible Menu Items Count:", result.length);
        return result;

    }, [userPermissions, getSubtitles]); // Dependencies


    // --- Render Function for a single menu item ---
    const renderMenuItem = (item) => {
        if (!item || typeof item.id === 'undefined') return null;

        // --- RENDER HEADING --- (Only if not collapsed)
        if (item.type === 'heading') {
            if (isCollapsed) return null;
            return ( <li key={item.id} className="sidebar-section-heading "><div className="sidebar-hr"><hr /></div><span style={{ paddingLeft:'25px'}}>{item.label}</span></li> );
        }

        // --- RENDER OTHER ITEMS ---
        const titleLabel = getItemLabel(item.label);
        const isActive = activeItemId === item.id;
        const isSubtitle = item.type === 'subtitle';
        const isParent = item.hasSubtitles;
        const parentItem = isSubtitle ? finalVisibleMenuItems.find(p => p.id === item.parentId) : item;
        const isEffectivelyExpanded = parentItem && expandedItems[parentItem.id];
        const liClasses = [ isActive ? "active" : "", isSubtitle ? "sidebar-subtitle" : "", isParent ? "sidebar-expandable" : "", isEffectivelyExpanded ? "expanded" : "", item.id === EXCLUDED_ITEM_ID ? "brand-item" : "", ].filter(Boolean).join(" ");
        const assignRef = (el) => { if (el && item.type !== 'heading' && item.id !== EXCLUDED_ITEM_ID) { itemRefs.current[item.id] = el; } else if (itemRefs.current[item.id]) { delete itemRefs.current[item.id]; } };

        return (
            <React.Fragment key={item.id}>
                <li ref={assignRef} className={liClasses} aria-expanded={isParent ? isEffectivelyExpanded : undefined} >
                    <Link to={item.path} title={isCollapsed ? titleLabel || undefined : undefined} onClick={(e) => handleItemClick(item, e)} aria-current={isActive ? "page" : undefined} >
                        {/* Icon */}
                        {item.id === EXCLUDED_ITEM_ID ? ( <span style={{marginTop:'15px'}} className="d-flex justify-self-center align-items-center text-center mainItem"> <img src="/logosite.png" className="align-self-center bg-light Navlogo" width="50" height="50" alt="Logo" style={{ transition: 'width 0.3s ease, height 0.3s ease' ,padding:'4px'}} /> {!isCollapsed && ( <span className="brand-text text-start"> GICOPMA <small className="d-block " style={{fontSize:'8px'}}>GESTION INTEGREE DES CONVENTIONS,<br/>PROJETS ET MARCHES</small> </span> )} </span> ) : item.icon ? ( <FontAwesomeIcon icon={item.icon} fixedWidth /> ) : ( isCollapsed && <span style={{display: 'inline-block', width: '1.25em'}}></span> )}
                        {/* Label and Arrow */}
                        {!isCollapsed && item.id !== EXCLUDED_ITEM_ID && ( <span className="sidebar-item-label"> {item.label} {isParent && ( <FontAwesomeIcon icon={faChevronDown} className="expand-arrow" /> )} </span> )}
                    </Link>
                </li>
                {/* Render Subtitles Conditionally */}
                {isParent && isEffectivelyExpanded && !isCollapsed && (
                    <ul className="sidebar-submenu">
                        {/* Get subtitles, filter them by visibility based on final list */}
                        {getSubtitles(item.id)
                            .filter(subItem => finalVisibleMenuItems.some(visible => visible.id === subItem.id))
                            .map(renderMenuItem)}
                    </ul>
                )}
            </React.Fragment>
        );
    };

    // --- Component Return ---
    return (
        <ul className={`sidebar ${isCollapsed ? 'is-collapsed' : ''}`} ref={sidebarRef}>
            {/* Selector Div */}
            <div className="selector-active" style={selectorStyle}>
                 <div className="top"></div><div className="bottom"></div>
            </div>

            {/* Render the FINAL filtered list, excluding top-level subtitles */}
            {finalVisibleMenuItems
                .filter(item => item.type !== 'subtitle')
                .map(renderMenuItem)}
        </ul>
    );
};

// PropTypes for currentUser
Sidebar.propTypes = {
    currentUser: PropTypes.shape({
        permissions: PropTypes.arrayOf(PropTypes.string)
    })
};

export default Sidebar;