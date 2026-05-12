<?php
$_SESSION['user_id'] = 1;
$_SESSION['logged_in'] = true;
$_GET['action'] = 'get_initial_data';
require 'Views/Money/api.php';
