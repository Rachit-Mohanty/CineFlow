const OWM_API_KEY = "f74b35b98d78c74eacf9e53db334aafd";

// --- WebGL Lightning Shader (Hero Odyssey Port) ---
let globalLightningHue = 220;

function initLightningWebGL() {
    const canvas = document.getElementById("lightning-canvas");
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) { console.error("WebGL not supported"); return; }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const vertexShaderSource = `
        attribute vec2 aPosition;
        void main() {
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;
        uniform vec2 iResolution;
        uniform float iTime;
        uniform float uHue;
        uniform float uXOffset;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform float uSize;
        
        #define OCTAVE_COUNT 10

        // Convert HSV to RGB
        vec3 hsv2rgb(vec3 c) {
            vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
            return c.z * mix(vec3(1.0), rgb, c.y);
        }

        float hash11(float p) {
            p = fract(p * .1031);
            p *= p + 33.33;
            p *= p + p;
            return fract(p);
        }

        float hash12(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * .1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        mat2 rotate2d(float theta) {
            float c = cos(theta);
            float s = sin(theta);
            return mat2(c, -s, s, c);
        }

        float noise(vec2 p) {
            vec2 ip = floor(p);
            vec2 fp = fract(p);
            float a = hash12(ip);
            float b = hash12(ip + vec2(1.0, 0.0));
            float c = hash12(ip + vec2(0.0, 1.0));
            float d = hash12(ip + vec2(1.0, 1.0));
            
            vec2 t = smoothstep(0.0, 1.0, fp);
            return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
        }

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < OCTAVE_COUNT; ++i) {
                value += amplitude * noise(p);
                p *= rotate2d(0.45);
                p *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
            vec2 uv = fragCoord / iResolution.xy;
            uv = 2.0 * uv - 1.0;
            uv.x *= iResolution.x / iResolution.y;
            uv.x += uXOffset;
            
            uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;
            
            float dist = abs(uv.x);
            vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
            vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
            col = pow(col, vec3(1.0));
            fragColor = vec4(col, 1.0);
        }

        void main() {
            mainImage(gl_FragColor, gl_FragCoord.xy);
        }
    `;

    function compileShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program linking error:", gl.getProgramInfoLog(program));
        return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const locResolution = gl.getUniformLocation(program, "iResolution");
    const locTime = gl.getUniformLocation(program, "iTime");
    const locHue = gl.getUniformLocation(program, "uHue");
    const locXOffset = gl.getUniformLocation(program, "uXOffset");
    const locSpeed = gl.getUniformLocation(program, "uSpeed");
    const locIntensity = gl.getUniformLocation(program, "uIntensity");
    const locSize = gl.getUniformLocation(program, "uSize");

    const startTime = performance.now();
    function render() {
        const currentTime = performance.now();
        gl.uniform2f(locResolution, canvas.width, canvas.height);
        gl.uniform1f(locTime, (currentTime - startTime) / 1000.0);
        
        // Hooking into global hue state
        gl.uniform1f(locHue, globalLightningHue);
        gl.uniform1f(locXOffset, 0);
        gl.uniform1f(locSpeed, 1.6);
        gl.uniform1f(locIntensity, 0.6);
        gl.uniform1f(locSize, 2);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

// --- Hue Slider UI Logic ---
function initHueSlider() {
    const slider = document.getElementById('hue-slider-native');
    const fill = document.getElementById('hue-fill');
    const thumbWrap = document.getElementById('hue-thumb-wrap');
    const valueLabel = document.getElementById('hue-value');
    const planet = document.getElementById('planet-sphere');
    const halo = document.getElementById('glow-halo');

    function updateSlider(val) {
        globalLightningHue = parseInt(val);
        const progress = (val / 360) * 100;
        
        fill.style.width = `${progress}%`;
        thumbWrap.style.left = `${progress}%`;
        valueLabel.innerText = `${val}°`;
        
        // Convert hue to a background color for the planet
        const hueColor = `hsl(${val}, 70%, 25%)`;
        planet.style.background = `radial-gradient(circle at 25% 90%, ${hueColor} 15%, rgba(0,0,0,0.87) 70%, rgba(0,0,0,0.93) 100%)`;
        halo.style.background = `linear-gradient(to bottom, hsla(${val}, 80%, 60%, 0.2), hsla(${val + 40}, 80%, 50%, 0.1))`;
    }

    slider.addEventListener('input', (e) => updateSlider(e.target.value));
    
    slider.addEventListener('mousedown', () => thumbWrap.className = "absolute top-1/2 z-30 thumb-active");
    slider.addEventListener('mouseup', () => thumbWrap.className = "absolute top-1/2 z-30 thumb-idle");
    slider.addEventListener('touchstart', () => thumbWrap.className = "absolute top-1/2 z-30 thumb-active");
    slider.addEventListener('touchend', () => thumbWrap.className = "absolute top-1/2 z-30 thumb-idle");
}

// --- Weather Data & Logic ---
const citiesByState = {
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati"],
    "Arunachal Pradesh": ["Itanagar", "Tawang", "Pasighat", "Ziro"],
    "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Tezpur", "Nagaon"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Biharsharif"],
    "Chhattisgarh": ["Raipur", "Bhilai Nagar", "Korba", "Bilaspur"],
    "Goa": ["Panaji", "Vasco da Gama", "Margao", "Ponda"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
    "Haryana": ["Faridabad", "Gurugram", "Rohtak", "Hisar", "Panipat"],
    "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City"],
    "Karnataka": ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad"],
    "Manipur": ["Imphal", "Bishnupur", "Ukhrul"],
    "Meghalaya": ["Shillong", "Tura", "Jowai"],
    "Mizoram": ["Aizawl", "Lunglei", "Champhai"],
    "Nagaland": ["Kohima", "Dimapur", "Mokokchung"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Puri"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur"],
    "Sikkim": ["Gangtok", "Namchi", "Mangan"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Erode"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
    "Tripura": ["Agartala", "Udaipur", "Kailasahar"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Meerut", "Varanasi", "Noida"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Haldwani", "Roorkee", "Rishikesh"],
    "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri"],
    "Andaman and Nicobar Islands": ["Sri Vijaya Puram"],
    "Chandigarh": ["Chandigarh"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Silvassa", "Diu"],
    "Delhi (NCT)": ["New Delhi", "Delhi"],
    "Jammu and Kashmir": ["Srinagar", "Jammu"],
    "Ladakh": ["Leh", "Kargil"],
    "Lakshadweep": ["Kavaratti"],
    "Puducherry": ["Puducherry", "Oulgaret"]
};

function switchView(viewId) {
    ['view-landing', 'view-app', 'view-connecting', 'view-all-cities'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.add('hidden');
        el.classList.remove('flex');
    });

    window.scrollTo(0,0);
    const target = document.getElementById('view-' + viewId);
    
    if (viewId === 'all-cities') {
        startConnectingSequence();
    } else {
        target.classList.remove('hidden');
        target.classList.add('flex');
        
        if (viewId === 'app') {
            const select = document.getElementById('city-select');
            if(!select.value) {
                select.selectedIndex = 1; 
                handleCityChange();
            }
        }
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

let connectingInterval, progressInterval;
function startConnectingSequence() {
    const connView = document.getElementById('view-connecting');
    connView.classList.remove('hidden');
    connView.classList.add('flex');

    const log = document.getElementById('connecting-log');
    const progressBar = document.getElementById('connecting-progress');
    const territories = Object.keys(citiesByState);
    let progress = 0, regionIndex = 0;

    progressBar.style.width = '0%';
    log.innerText = 'Initializing handshake...';

    clearInterval(connectingInterval);
    clearInterval(progressInterval);

    connectingInterval = setInterval(() => {
        if (regionIndex < territories.length) {
            log.innerText = `Syncing nodes: ${territories[regionIndex]}...`;
            regionIndex++;
        } else {
            log.innerText = `Finalizing secure connection...`;
        }
    }, 100);

    progressInterval = setInterval(() => {
        progress += 2;
        progressBar.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(connectingInterval);
            clearInterval(progressInterval);
            setTimeout(() => {
                connView.classList.add('hidden');
                connView.classList.remove('flex');
                document.getElementById('view-all-cities').classList.remove('hidden');
                document.getElementById('view-all-cities').classList.add('flex');
                loadAllCitiesWeather();
            }, 300);
        }
    }, 40);
}

function initCitySelect() {
    const select = document.getElementById('city-select');
    for (const [state, cities] of Object.entries(citiesByState)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = state;
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city; option.textContent = city;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    }
}

// OWM specifically mapped codes
function getWeatherDetails(code) {
    if (code >= 200 && code < 300) return { text: "Thunderstorm", icon: "⛈️" };
    if (code >= 300 && code < 400) return { text: "Drizzle", icon: "🌧️" };
    if (code >= 500 && code < 600) return { text: "Rain", icon: "🌧️" };
    if (code >= 600 && code < 700) return { text: "Snow", icon: "🌨️" };
    if (code >= 700 && code < 800) return { text: "Fog", icon: "🌫️" };
    if (code === 800) return { text: "Clear Sky", icon: "☀️" };
    if (code === 801 || code === 802) return { text: "Partly Cloudy", icon: "⛅" };
    if (code >= 803) return { text: "Overcast", icon: "☁️" };
    return { text: "Unknown", icon: "🌍" };
}

// Open-Meteo fallback codes mapping
function getOMWeatherDetails(code) {
    const map = {
        0: { text: "Clear Sky", icon: "☀️" }, 1: { text: "Mainly Clear", icon: "🌤️" },
        2: { text: "Partly Cloudy", icon: "⛅" }, 3: { text: "Overcast", icon: "☁️" },
        45: { text: "Fog", icon: "🌫️" }, 51: { text: "Light Drizzle", icon: "🌧️" },
        61: { text: "Slight Rain", icon: "🌦️" }, 63: { text: "Rain", icon: "🌧️" },
        71: { text: "Slight Snow", icon: "🌨️" }, 95: { text: "Thunderstorm", icon: "⛈️" }
    };
    return map[code] || map[Object.keys(map).find(k => Math.abs(k - code) <= 2)] || { text: "Unknown", icon: "🌍" };
}

async function handleCityChange() {
    const city = document.getElementById('city-select').value;
    if (!city) return;

    document.getElementById('current-temp').innerText = '...';
    document.getElementById('current-condition').innerText = 'FETCHING SATELLITE DATA...';
    document.getElementById('forecast-list').innerHTML = '<div class="text-center text-white/50 py-8 animate-pulse col-span-full w-full">Establishing connection...</div>';

    try {
        // ATTEMPT 1: Try OpenWeatherMap
        const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OWM_API_KEY}`);
        const geoData = await geoRes.json();
        
        // If the key throws a 401 Unauthorized, we throw an error immediately to hit the catch block
        if (geoData.cod === 401 || geoData.cod === '401') throw new Error("401_UNAUTHORIZED");
        if (!Array.isArray(geoData) || geoData.length === 0) throw new Error("INVALID_GEO");
        
        const { lat, lon } = geoData[0];

        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_API_KEY}`);
        const data = await weatherRes.json();

        const details = getWeatherDetails(data.weather[0].id);
        document.getElementById('current-temp').innerText = Math.round(data.main.temp) + '°';
        document.getElementById('current-condition').innerText = details.text;
        document.getElementById('current-icon').innerText = details.icon;
        document.getElementById('current-bg-icon').innerText = details.icon;
        document.getElementById('current-wind').innerText = Math.round(data.wind.speed * 3.6) + ' km/h'; 
        document.getElementById('current-humidity').innerText = data.main.humidity + '%';

        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_API_KEY}`);
        const forecastData = await forecastRes.json();

        const dailyData = {};
        forecastData.list.forEach(item => {
            const date = item.dt_txt.split(' ')[0];
            if (!dailyData[date]) {
                dailyData[date] = { temp_max: item.main.temp_max, temp_min: item.main.temp_min, weather_code: item.weather[0].id, dateStr: date };
            } else {
                dailyData[date].temp_max = Math.max(dailyData[date].temp_max, item.main.temp_max);
                dailyData[date].temp_min = Math.min(dailyData[date].temp_min, item.main.temp_min);
            }
        });

        const forecastContainer = document.getElementById('forecast-list');
        forecastContainer.innerHTML = ''; 
        
        let i = 0;
        for (const date in dailyData) {
            if (i >= 5) break; 
            const dayData = dailyData[date];
            const dateObj = new Date(dayData.dateStr);
            const dayName = i === 0 ? 'TODAY' : dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayDetails = getWeatherDetails(dayData.weather_code);
            
            forecastContainer.innerHTML += `
                <div class="border border-white/10 rounded-xl p-3 md:p-4 flex flex-col items-center justify-center bg-black/20 hover:bg-white/5 transition-colors text-center backdrop-blur-sm">
                    <div class="font-medium text-white/60 tracking-wider text-[10px] md:text-xs mb-2 md:mb-3">${dayName}</div>
                    <div class="text-3xl mb-2 md:mb-3 vibrant-icon">${dayDetails.icon}</div>
                    <div class="text-lg md:text-xl font-light w-full flex justify-center gap-2 md:gap-3">
                        <span>${Math.round(dayData.temp_max)}°</span>
                        <span class="text-white/30">${Math.round(dayData.temp_min)}°</span>
                    </div>
                </div>
            `;
            i++;
        }
    } catch (error) {
        // ATTEMPT 2: Fallback to Open-Meteo silently to provide a seamless experience
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
            const geoData = await geoRes.json();
            if (!geoData.results || geoData.results.length === 0) throw new Error("Not found");
            const { latitude, longitude } = geoData.results[0];

            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
            const data = await weatherRes.json();

            const details = getOMWeatherDetails(data.current.weather_code);
            document.getElementById('current-temp').innerText = Math.round(data.current.temperature_2m) + '°';
            
            // Show a subtle hint that we are using backup telemetry if the OWM key failed
            let conditionText = details.text;
            if (error.message === "401_UNAUTHORIZED") conditionText += " (Backup Satellite)";
            
            document.getElementById('current-condition').innerText = conditionText;
            document.getElementById('current-icon').innerText = details.icon;
            document.getElementById('current-bg-icon').innerText = details.icon;
            document.getElementById('current-wind').innerText = data.current.wind_speed_10m + ' km/h';
            document.getElementById('current-humidity').innerText = data.current.relative_humidity_2m + '%';

            const forecastContainer = document.getElementById('forecast-list');
            forecastContainer.innerHTML = ''; 
            for (let i = 0; i < 5; i++) {
                const date = new Date(data.daily.time[i]);
                const dayName = i === 0 ? 'TODAY' : date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                const dayDetails = getOMWeatherDetails(data.daily.weather_code[i]);
                
                forecastContainer.innerHTML += `
                    <div class="border border-white/10 rounded-xl p-3 md:p-4 flex flex-col items-center justify-center bg-black/20 hover:bg-white/5 transition-colors text-center backdrop-blur-sm">
                        <div class="font-medium text-white/60 tracking-wider text-[10px] md:text-xs mb-2 md:mb-3">${dayName}</div>
                        <div class="text-3xl mb-2 md:mb-3 vibrant-icon">${dayDetails.icon}</div>
                        <div class="text-lg md:text-xl font-light w-full flex justify-center gap-2 md:gap-3">
                            <span>${Math.round(data.daily.temperature_2m_max[i])}°</span>
                            <span class="text-white/30">${Math.round(data.daily.temperature_2m_min[i])}°</span>
                        </div>
                    </div>
                `;
            }
        } catch(fallbackErr) {
            // Both APIs failed
            document.getElementById('current-condition').innerText = 'ERROR LOCATING NODE';
            document.getElementById('forecast-list').innerHTML = '<div class="text-center text-red-400 py-8 col-span-full w-full">Telemetry failed across all networks. Verify connection.</div>';
        }
    }
}

let isAllCitiesInitialized = false;
function loadAllCitiesWeather() {
    if (isAllCitiesInitialized) return;
    isAllCitiesInitialized = true;

    const container = document.getElementById('all-cities-container');
    const fetchQueue = [];

    for (const [state, cities] of Object.entries(citiesByState)) {
        const sId = state.replace(/\s/g, '');
        container.innerHTML += `
            <div class="mb-10 fade-in">
                <div class="flex items-center gap-4 mb-6 border-b border-white/10 pb-3">
                    <h2 class="text-xl md:text-2xl font-light">${state}</h2>
                    <span class="bg-white/10 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-full tracking-widest border border-white/5">${cities.length} NODES</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="grid-${sId}"></div>
            </div>
        `;
        cities.forEach(city => {
            const cId = city.replace(/\s/g, '');
            document.getElementById(`grid-${sId}`).innerHTML += `
                <div class="glass-card p-4 md:p-5 flex justify-between items-center hover:bg-white/5 transition-all duration-300 transform hover:-translate-y-1">
                    <div>
                        <div class="font-medium text-base md:text-lg">${city}</div>
                        <div class="text-white/50 text-[10px] md:text-xs mt-1" id="desc-${cId}">Connecting...</div>
                    </div>
                    <div class="text-right flex items-center justify-end gap-2 md:gap-3">
                        <div class="text-xl md:text-2xl filter drop-shadow-md vibrant-icon" id="icon-${cId}">⏳</div>
                        <div class="text-2xl md:text-3xl font-light w-12 md:w-16 text-right" id="temp-${cId}">--°</div>
                    </div>
                </div>
            `;
            fetchQueue.push({city, cId});
        });
    }

    fetchQueue.forEach((item, i) => {
        setTimeout(async () => {
            try {
                const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(item.city)}&limit=1&appid=${OWM_API_KEY}`);
                const geo = await geoRes.json();
                
                if (geo.cod === 401 || geo.cod === '401') throw new Error("401");
                if (!Array.isArray(geo) || geo.length === 0) throw new Error("Invalid");

                const wx = await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_API_KEY}`)).json();
                const dt = getWeatherDetails(wx.weather[0].id);
                document.getElementById(`temp-${item.cId}`).innerText = `${Math.round(wx.main.temp)}°`;
                document.getElementById(`icon-${item.cId}`).innerText = dt.icon;
                document.getElementById(`desc-${item.cId}`).innerText = dt.text;
            } catch(e) {
                // Fallback to Open-Meteo silently
                try {
                    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(item.city)}&count=1&language=en&format=json`);
                    const geoData = await geoRes.json();
                    const { latitude, longitude } = geoData.results[0];
                    
                    const wx = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`)).json();
                    const dt = getOMWeatherDetails(wx.current.weather_code);
                    
                    document.getElementById(`temp-${item.cId}`).innerText = `${Math.round(wx.current.temperature_2m)}°`;
                    document.getElementById(`icon-${item.cId}`).innerText = dt.icon;
                    document.getElementById(`desc-${item.cId}`).innerText = dt.text;
                } catch(fallbackErr) {
                    document.getElementById(`temp-${item.cId}`).innerText = "N/A";
                    document.getElementById(`icon-${item.cId}`).innerText = "❌";
                    document.getElementById(`desc-${item.cId}`).innerText = "Telemetry Failed";
                }
            }
        }, i * 300);
    });
}

setInterval(() => {
    const el = document.getElementById('real-time-date');
    if (el) el.innerText = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second:'2-digit' });
}, 1000);

window.addEventListener('DOMContentLoaded', () => {
    initLightningWebGL();
    initHueSlider();
    initCitySelect();
});