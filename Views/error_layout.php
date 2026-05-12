<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50 dark:bg-[#111318]">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="description" content="<?php echo $pageDescription ?? 'Error - zomzam.com'; ?>">
  <title><?php echo $pageTitle ?? 'Error - zomzam.com'; ?></title>
  
  <link rel="icon" type="image/x-icon" href="/Assets/Img/favicon.ico">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- We use Inter and outfit for the ultra-bold look -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Outfit:wght@800;900&display=swap" rel="stylesheet">
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            display: ['Outfit', 'sans-serif'],
          },
          colors: {
            primary: {
              50: '#fff0eb', 100: '#ffdcd1', 200: '#ffbfa8', 300: '#ff9874', 
              400: '#ff6633', 500: '#EE5712', 600: '#df3c0b', 700: '#b92b0b',
            }
          }
        }
      }
    }
  </script>
  <style type="text/tailwindcss">
    .grid-bg {
      background-image: 
        linear-gradient(rgba(238, 87, 18, 0.15) 1px, transparent 1px), 
        linear-gradient(90deg, rgba(238, 87, 18, 0.15) 1px, transparent 1px);
      background-size: 60px 60px;
    }
    .dark .grid-bg {
      background-image: 
        linear-gradient(rgba(238, 87, 18, 0.25) 1px, transparent 1px), 
        linear-gradient(90deg, rgba(238, 87, 18, 0.25) 1px, transparent 1px);
    }
    .huge-text {
      font-size: clamp(15rem, 35vw, 40rem);
      line-height: 0.8;
      letter-spacing: -0.05em;
    }
  </style>
</head>
<body class="h-full flex p-2 md:p-6 antialiased overflow-hidden">
  
  <!-- Main Error Container -->
  <div class="flex-1 relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-b from-white via-primary-50 to-primary-600 dark:from-slate-900 dark:via-primary-900/40 dark:to-primary-600 flex flex-col items-center justify-center w-full h-full border border-slate-200 dark:border-slate-800">
    
    <!-- The Grid Overlay -->
    <div class="absolute inset-0 grid-bg z-10 pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>

    <!-- The Huge Background Number -->
    <div class="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-0">
      <span class="huge-text font-display font-black text-slate-800 dark:text-black/80 select-none">
        <?php echo $errorCode ?? '404'; ?>
      </span>
    </div>

    <!-- The Foreground Content -->
    <div class="relative z-20 text-center px-6 mt-32 md:mt-48 max-w-4xl">
      <p class="text-sm font-bold text-white/80 dark:text-white/60 mb-3 tracking-widest">
        <?php echo $errorCode ?? '404'; ?> ERROR
      </p>
      
      <h1 class="text-5xl md:text-7xl lg:text-8xl font-display font-black text-white uppercase tracking-tight mb-6" style="text-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <?php echo $errorTitle ?? 'YOU MISSED THE SHOT'; ?>
      </h1>
      
      <p class="text-lg md:text-xl text-white/90 font-medium max-w-2xl mx-auto mb-10 leading-relaxed shadow-sm">
        <?php echo $errorMessage ?? 'Looks like the page you\'re looking for didn\'t make the play. No worries — the game\'s still on elsewhere.'; ?>
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a href="<?php echo $btnLink ?? '/'; ?>" class="inline-flex items-center justify-center px-10 py-4 bg-white text-slate-900 hover:bg-slate-50 font-bold rounded-full hover:scale-105 transition-all shadow-xl hover:shadow-2xl">
          <?php echo $btnText ?? 'Get Me Home'; ?>
        </a>
        
        <?php if(isset($showDetails) && $showDetails): ?>
        <button onclick="document.getElementById('error-details').classList.toggle('hidden')" class="inline-flex items-center justify-center px-10 py-4 bg-black/20 text-white hover:bg-black/30 backdrop-blur-md font-bold rounded-full transition-all">
          View Details
        </button>
        <?php endif; ?>
      </div>

      <!-- Hidden Details -->
      <?php if(isset($showDetails) && $showDetails): ?>
      <div id="error-details" class="hidden mt-8 p-6 bg-black/40 backdrop-blur-xl rounded-2xl text-left text-sm text-white/80 border border-white/10 max-w-lg mx-auto">
        <p class="mb-2"><strong class="text-white">Request URI:</strong> <code class="font-mono bg-black/50 px-2 py-1 rounded"><?php echo htmlspecialchars($_SERVER['REQUEST_URI'] ?? '/'); ?></code></p>
        <p><strong class="text-white">Timestamp:</strong> <code class="font-mono bg-black/50 px-2 py-1 rounded"><?php echo date('Y-m-d H:i:s'); ?></code></p>
      </div>
      <?php endif; ?>
    </div>
    
  </div>

</body>
</html>
