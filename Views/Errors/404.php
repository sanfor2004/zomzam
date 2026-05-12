<?php
/**
 * 404 Not Found Error Page
 */

http_response_code(404);

$pageTitle = '404 Not Found - zomzam.com';
$pageDescription = 'The page you are looking for does not exist';

$errorCode = '404';
$errorTitle = 'YOU MISSED THE SHOT';
$errorMessage = 'Looks like the page you\'re looking for didn\'t make the play. No worries — the game\'s still on elsewhere.';
$btnText = 'Get Me Home';
$btnLink = '/';
$showDetails = true;

require_once __DIR__ . '/../error_layout.php';
?>