<?php
/**
 * 403 Forbidden Error Page
 */

http_response_code(403);

$pageTitle = '403 Forbidden - zomzam.com';
$pageDescription = 'Access to this resource is forbidden';

$errorCode = '403';
$errorTitle = 'OUT OF BOUNDS';
$errorMessage = 'You don\'t have the right clearance to be on this part of the court. Let\'s get you back to the main game.';
$btnText = 'Return to Court';
$btnLink = '/';
$showDetails = true;

require_once __DIR__ . '/../error_layout.php';
?>