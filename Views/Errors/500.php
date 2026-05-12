<?php
/**
 * 500 Internal Server Error Page
 */

http_response_code(500);

$pageTitle = '500 Internal Server Error - zomzam.com';
$pageDescription = 'An unexpected error occurred';

$errorCode = '500';
$errorTitle = 'SERVER TOOK A TIMEOUT';
$errorMessage = 'Our servers fumbled the play. We\'re already reviewing the tape to fix it. Give it another try in a few.';
$btnText = 'Refresh Play';
$btnLink = 'javascript:location.reload()';
$showDetails = true;

require_once __DIR__ . '/../error_layout.php';
?>