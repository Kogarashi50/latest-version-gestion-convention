// src/pages/WelcomePage.jsx

import React from 'react';
import { Container, Row, Col, Card, Button, Image } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandshake, faFileContract, faProjectDiagram, faClipboardCheck, faArrowRight, faChartLine, faStar } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import './welcome.css'; // Ensure CSS is imported
import DashboardPage from './dashboard';

// Optional: import logo from '../assets/logo-light.png';

const WelcomePage = ({currentUser}) => {

    // const navigate = useNavigate();
    // const handleAboutRedirect = () => navigate('/about');

if(!currentUser.permissions.includes("view dashboard")){
    return <DashboardPage currentUser={currentUser}/>
}

    return (
        // Container fluid takes full width. pt-4 provides top padding.
        // px-0 removes default horizontal padding if main-content already has it.
        <Container fluid className=" px-0 welcome-content-area  border-0">
            {/* Row takes full width within the container */}
            <Row className="g-0">
                {/* Column takes full width, content will center via Card props */}
                <Col xs={12}>
                    {/* Card with no border, text-center for content alignment */}
                    {/* Use background variant matching the main content area bg if needed */}
                    <Card className="text-center border-0 welcome-card-themed-full">

                        {/* Header using the dark theme color */}
                        <Card.Header className=" rounded-5" style={{ backgroundColor: '#3c3c3c', color: 'white', borderBottom: '3px solid var(--bs-warning)' /* Use Bootstrap warning color */ }}>
                             <Image src='/logosite.png' width="80" height="80" roundedCircle className="mb-3 bg-white p-2" alt="GICOPMA Logo"/>
                            <h2 className="mb-1 fw-bold">Bienvenue sur GICOPMA</h2>
                            <p className="mb-0 lead fs-6" style={{ color: 'rgba(255,255,255,0.8)' }}> {/* Lighter white text */}
                                Gestion Intégrée des Conventions, Projets et Marchés
                            </p>
                        </Card.Header>

                        <Card.Body className="p-3 p-lg-4 border-0">

                            <Card.Title as="h3" className="mb-3 fw-semibold text-dark">
                                Votre Plateforme Centralisée
                            </Card.Title>

                            <Card.Text className="text-muted mb-4 mx-auto" style={{ maxWidth: '800px' }}>
                                {/* Slightly wider max-width */}
                                GICOPMA est l'outil essentiel pour optimiser et simplifier le suivi de vos conventions,
                                la gestion de vos projets, l'administration des marchés publics, et la collaboration avec vos partenaires.
                            </Card.Text>

                            {/* Feature Highlights - Using theme colors */}
                            <Row className="justify-content-center text-start mb-4 g-4">
                                <Col xs={12} xl={3}> {/* Adjust column sizes */}
                                    <div className="d-flex align-items-start p-3 rounded feature-box feature-box-dark">
                                        <FontAwesomeIcon icon={faFileContract} size="2x" className="text-warning me-3 fa-fw mt-1" />
                                        <div>
                                            <h6 className="mb-1 fw-bold">Conventions</h6>
                                            <p className="mb-0 small">Suivi complet, documents et avenants.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col xs={12} xl={3}>
                                    <div className="d-flex align-items-start p-3 rounded feature-box feature-box-light">
                                        <FontAwesomeIcon icon={faProjectDiagram} size="2x" className="text-dark me-3 fa-fw mt-1" />
                                        <div>
                                            <h6 className="mb-1 fw-bold">Projets</h6>
                                            <p className="mb-0 small">Gestion des informations clés et avancement.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col xs={12}  xl={3}>
                                     <div className="d-flex align-items-start p-3 rounded feature-box feature-box-dark">
                                         <FontAwesomeIcon icon={faClipboardCheck} size="2x" className="text-warning me-3 fa-fw mt-1" />
                                         <div>
                                             <h6 className="mb-1 fw-bold">Marchés Publics</h6>
                                             <p className="mb-0 small">Administration des lots, contrats et suivi.</p>
                                         </div>
                                     </div>
                                 </Col>
                                 <Col xs={12} xl={3}>
                                      <div className="d-flex align-items-start p-3 rounded feature-box feature-box-light">
                                          <FontAwesomeIcon icon={faHandshake} size="2x" className="text-dark me-3 fa-fw mt-1" />
                                          <div>
                                              <h6 className="mb-1 fw-bold">Partenaires</h6>
                                              <p className="mb-0 small">Gestion des infos et engagements financiers.</p>
                                          </div>
                                      </div>
                                  </Col>
                            </Row>

                             <hr className='my-4' />

                             <p className="text-muted mb-2 small">
                                 Utilisez la barre latérale à gauche pour naviguer à travers les différentes sections de l'application.
                             </p>

                            {/* Optional Button */}
                            {/*
                            <Button variant="warning" size="sm" className="mt-3 rounded-pill px-4 text-dark fw-medium">
                                Documentation <FontAwesomeIcon icon={faArrowRight} className="ms-1" />
                            </Button>
                            */}

                      
                        <div className="text-muted bg-light p-3 mt-5 small border-0 rounded-5 ">
                             Plateforme GICOPMA - Tous droits réservés
                         </div> 
                          </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default WelcomePage;