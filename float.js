document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const floatPrecisionSelect = document.getElementById('float-precision');
    const floatInput = document.getElementById('float-input');
    const representBtn = document.getElementById('float-represent-btn');
    const floatHeader = document.getElementById('float-header');
    const representationHeader = document.getElementById('representation-header');
    const ieeeDetailsP = document.getElementById('ieee-details');
    const ieeeBitsInfoUl = document.getElementById('ieee-bits-info');
    const biasExplanationP = document.getElementById('bias-explanation');

    const signBitDiv = document.getElementById('sign-bit');
    const exponentBitsDiv = document.getElementById('exponent-bits');
    const mantissaBitsDiv = document.getElementById('mantissa-bits');
    const floatDetailsDiv = document.getElementById('float-details');
    const floatRepresentationContainer = document.getElementById('float-representation'); // Container for bits

    // Interactive elements (Keep 32-bit focused for now)
    const compSection = document.querySelector('section:nth-of-type(2)'); // Section containing interactive part
    const compSignSelect = document.getElementById('float-s');
    const compExponentInput = document.getElementById('float-e');
    const compMantissaInput = document.getElementById('float-m');
    const calculateCompBtn = document.getElementById('calculate-from-components');
    const componentResultDiv = document.getElementById('component-result');
    const biasedExponentSpan = document.getElementById('biased-e-out');
    const interactiveNote = compSection.querySelector('p > i'); // Note about 32-bit limitation

    // --- Precision Parameters ---
    const params = {
        '32': { bytes: 4, exponentBits: 8, mantissaBits: 23, bias: 127, name: 'Single Precision' },
        '64': { bytes: 8, exponentBits: 11, mantissaBits: 52, bias: 1023, name: 'Double Precision' }
    };

    let currentPrecision = '32'; // Default precision

    // --- Event Listeners ---
    representBtn.addEventListener('click', handleDecimalToFloat);
    floatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleDecimalToFloat();
    });
    floatPrecisionSelect.addEventListener('change', handlePrecisionChange);

    // Interactive section listeners (32-bit specific)
    calculateCompBtn.addEventListener('click', handleComponentsToDecimal32);
    compExponentInput.addEventListener('input', updateBiasedExponentDisplay32);

    // --- Initialization ---
    handlePrecisionChange(); // Initialize UI based on default precision
    // handleDecimalToFloat(); // Calculate for default input value after init


    // --- Handlers ---

    function handlePrecisionChange() {
        currentPrecision = floatPrecisionSelect.value;
        const { exponentBits, mantissaBits, bias, name } = params[currentPrecision];

        // Update UI Text
        floatHeader.textContent = `Числа с плавающей точкой (IEEE 754 - ${currentPrecision} бит)`;
        representationHeader.textContent = `Представление Float (${currentPrecision}-bit)`;
        ieeeDetailsP.textContent = `Стандарт IEEE 754 (${name.toLowerCase()}, ${currentPrecision} бит):`;
        ieeeBitsInfoUl.innerHTML = `
            <li><b>S (Знак):</b> 1 бит (0 - плюс, 1 - минус)</li>
            <li><b>E (Порядок/Экспонента):</b> ${exponentBits} бит. Хранится смещенное значение (E<sub>смещ</sub> = E + bias). Для ${currentPrecision}-бит bias = ${bias}.</li>
            <li><b>M (Мантисса):</b> ${mantissaBits} бит. Хранится дробная часть нормализованной мантиссы (целая часть '1' подразумевается для нормализованных).</li>`;
        biasExplanationP.innerHTML = `<b>Смещение экспоненты (Bias):</b> Чтобы хранить и положительные, и отрицательные порядки, к реальному порядку E прибавляют смещение (${bias} для ${currentPrecision}-бит). E<sub>смещ</sub> = E + ${bias}.`;

        // Update interactive section (limit to 32-bit for now)
        const is32bit = currentPrecision === '32';
        compSection.style.opacity = is32bit ? '1' : '0.5';
        interactiveNote.style.display = is32bit ? 'none' : 'inline';
        compMantissaInput.maxLength = params['32'].mantissaBits; // Keep interactive mantissa at 23 bits
        compExponentInput.disabled = !is32bit;
        compMantissaInput.disabled = !is32bit;
        compSignSelect.disabled = !is32bit;
        calculateCompBtn.disabled = !is32bit;
        if (is32bit) {
            updateBiasedExponentDisplay32(); // Update bias display
        } else {
             biasedExponentSpan.textContent = `(не для ${currentPrecision}-бит)`;
             componentResultDiv.textContent = `Интерактивный режим только для 32-бит.`;
        }


        // Clear previous bit displays and re-run calculation for the current number
        clearPreviousResults();
        handleDecimalToFloat();
    }


    function handleDecimalToFloat() {
        clearPreviousResults();
        const decimalValueStr = floatInput.value;
        let decimalValue = parseFloat(decimalValueStr);

        if (isNaN(decimalValue) && decimalValueStr.trim().toLowerCase() !== 'nan') {
             displayError("Неверный формат десятичного числа.");
             return;
        }
         // Allow explicit "NaN" input
         if (decimalValueStr.trim().toLowerCase() === 'nan') {
            decimalValue = NaN;
         }


        const { bytes, exponentBits, mantissaBits, bias } = params[currentPrecision];
        const buffer = new ArrayBuffer(bytes);
        const view = new DataView(buffer);

        let sign, exponentBinStr, mantissaBinStr;

        try {
            if (currentPrecision === '32') {
                view.setFloat32(0, decimalValue, false); // false = big-endian
                const fullBits = view.getUint32(0).toString(2).padStart(32, '0');
                sign = parseInt(fullBits[0]);
                exponentBinStr = fullBits.substring(1, 1 + exponentBits);
                mantissaBinStr = fullBits.substring(1 + exponentBits);
            } else { // 64-bit
                view.setFloat64(0, decimalValue, false); // false = big-endian
                // Read as two 32-bit integers (Big-Endian)
                const highBits = view.getUint32(0).toString(2).padStart(32, '0');
                const lowBits = view.getUint32(4).toString(2).padStart(32, '0');
                const fullBits = highBits + lowBits;
                sign = parseInt(fullBits[0]);
                exponentBinStr = fullBits.substring(1, 1 + exponentBits);
                mantissaBinStr = fullBits.substring(1 + exponentBits);
            }

            const { type, details } = analyzeFloatBits(sign, exponentBinStr, mantissaBinStr, decimalValue, currentPrecision);
            displayFloatRepresentation(sign, exponentBinStr, mantissaBinStr, details);

             // Update 32-bit interactive components if 32-bit mode is active
             if (currentPrecision === '32') {
                 updateInteractiveComponents32(sign, exponentBinStr, mantissaBinStr);
             }

        } catch (error) {
            console.error("Conversion error:", error);
            displayError(`Ошибка преобразования: ${error.message}`);
        }
    }

    // --- Bit Analysis Logic ---
    function analyzeFloatBits(sign, exponentBinStr, mantissaBinStr, originalValue, precision) {
        const { exponentBits, mantissaBits, bias } = params[precision];
        const biasedExponent = parseInt(exponentBinStr, 2);
        const maxBiasedExponent = (1 << exponentBits) - 1; // All 1s

        let type = 'Неизвестно';
        let details = `Число: ${originalValue}<br>`;
        let realExponent = '';
        let formula = '';

        const isMantissaZero = !mantissaBinStr.includes('1');

        // Special Cases Check
        if (biasedExponent === maxBiasedExponent) { // All 1s in exponent
            if (isMantissaZero) {
                type = 'Бесконечность';
                formula = `Значение: ${sign === 0 ? '+' : '-'}Infinity`;
            } else {
                type = 'NaN (Не число)';
                formula = `Значение: NaN`;
            }
        } else if (biasedExponent === 0) { // All 0s in exponent
            if (isMantissaZero) {
                type = 'Нуль';
                 // Use Object.is to distinguish +0 and -0 if originalValue is available
                formula = `Значение: ${Object.is(originalValue, -0) ? '-0' : '0'}`;
            } else {
                type = 'Денормализованное';
                realExponent = 1 - bias; // Fixed exponent for denormalized
                 // Formula: (-1)^S * 0.M * 2^(1-bias)
                formula = `Формула: (-1)<sup>${sign}</sup> * 0.${mantissaBinStr} * 2<sup>${realExponent}</sup>`;
            }
        } else { // Normalized number
            type = 'Нормализованное';
            realExponent = biasedExponent - bias;
            // Formula: (-1)^S * 1.M * 2^(E)
            formula = `Формула: (-1)<sup>${sign}</sup> * 1.${mantissaBinStr} * 2<sup>${realExponent}</sup>`;
        }

        details += `Тип: <b>${type}</b><br>`;
        details += `Знак (S): ${sign}<br>`;
        details += `Смещенная экспонента (E<sub>смещ</sub>): ${biasedExponent} = <span>${formatBits(exponentBinStr, 'exponent', precision)}</span><sub>2</sub><br>`;
        if (realExponent !== '') {
           details += `Реальная экспонента (E): ${realExponent} (= ${biasedExponent} - ${bias})<br>`;
        }
        details += `Мантисса (M): ${formatBits(mantissaBinStr, 'mantissa', precision)}<br>`;
        details += formula;


        return { type, details };
    }


    // --- DOM Update Functions ---

    function displayFloatRepresentation(sign, expBits, mantBits, detailsHTML) {
        const { exponentBits, mantissaBits } = params[currentPrecision];
        requestAnimationFrame(() => {
            signBitDiv.textContent = sign;
            signBitDiv.style.backgroundColor = sign === 1 ? 'var(--color-background-error)' : 'var(--color-background-success)';

            exponentBitsDiv.innerHTML = formatBits(expBits.padStart(exponentBits, '0'), 'exponent', currentPrecision);
            mantissaBitsDiv.innerHTML = formatBits(mantBits.padEnd(mantissaBits, '0'), 'mantissa', currentPrecision);

            floatDetailsDiv.innerHTML = detailsHTML;

            // Add animation class
            floatRepresentationContainer.classList.add('fade-in');
            floatDetailsDiv.classList.add('fade-in');

            // Remove animation class after duration
            setTimeout(() => {
                 floatRepresentationContainer.classList.remove('fade-in');
                 floatDetailsDiv.classList.remove('fade-in');
            }, 500); // Match CSS animation duration
        });
    }

    function formatBits(bits, type, precision) {
        const { exponentBits, mantissaBits } = params[precision];
        const len = type === 'exponent' ? exponentBits : mantissaBits;
        if (!bits) return '?'.repeat(len); // Handle potential undefined bits

        let formatted = '';
        let chunkSize = 4; // Default chunk size

        // Adjust chunking for better readability based on length
        if (type === 'exponent') {
            if (len === 11) chunkSize = 4; // e.g., 1011 0110 101
            else chunkSize = 4; // 8 -> 1011 0110
        } else if (type === 'mantissa') {
            if (len === 52) chunkSize = 8; // Group by 8 for 52 bits
            else chunkSize = 4; // Group by 4 for 23 bits
        }

        for (let i = 0; i < bits.length; i += chunkSize) {
            formatted += bits.substring(i, Math.min(i + chunkSize, bits.length)) + ' ';
        }
         formatted = formatted.trim();

        // Wrap each chunk in a span for potential styling/spacing
        return `<span>${formatted.replace(/ /g, '</span> <span>')}</span>`;
    }

    function clearPreviousResults() {
        const { exponentBits, mantissaBits } = params[currentPrecision];
        signBitDiv.textContent = '?';
        exponentBitsDiv.innerHTML = formatBits('?'.repeat(exponentBits), 'exponent', currentPrecision);
        mantissaBitsDiv.innerHTML = formatBits('?'.repeat(mantissaBits), 'mantissa', currentPrecision);
        floatDetailsDiv.innerHTML = '';
        signBitDiv.style.backgroundColor = ''; // Reset background
        componentResultDiv.textContent = ''; // Clear interactive result too
    }

    function displayError(message) {
         floatDetailsDiv.innerHTML = `<p class="error-message">${message}</p>`;
         signBitDiv.textContent = 'E';
         signBitDiv.style.backgroundColor = 'var(--color-background-error)';
         const { exponentBits, mantissaBits } = params[currentPrecision];
         exponentBitsDiv.innerHTML = `<span style="color:var(--color-text-error);">ERR</span>`;
         mantissaBitsDiv.innerHTML = `<span style="color:var(--color-text-error);">ERROR</span>`;
     }

    function displayComponentError(message) {
        componentResultDiv.innerHTML = `<span class="error-message">${message}</span>`;
    }

    // --- Interactive Section Logic (32-bit ONLY) ---

    function updateBiasedExponentDisplay32() {
         // Only works when 32-bit is selected
         if (currentPrecision !== '32') return;
         const { bias } = params['32'];
         const realE = parseInt(compExponentInput.value);
         if (!isNaN(realE)) {
             biasedExponentSpan.textContent = realE + bias;
         } else {
             biasedExponentSpan.textContent = '---';
         }
     }

     function updateInteractiveComponents32(sign, expBits, mantBits) {
         if (currentPrecision !== '32') return; // Only update if in 32-bit mode

         const { bias } = params['32'];
         const biasedExponent = parseInt(expBits, 2);
         let realExponent = '';

         // Determine 'real' exponent based on representation type
        if (biasedExponent === 0) { // Zero or Denormalized
            realExponent = 1 - bias; // -126
         } else if (biasedExponent === 255) { // Infinity or NaN
             realExponent = ''; // Cannot represent with a single E
         } else { // Normalized
             realExponent = biasedExponent - bias;
         }

        compSignSelect.value = sign;
         compExponentInput.value = realExponent; // Might be empty for Inf/NaN
        compMantissaInput.value = mantBits;

         updateBiasedExponentDisplay32(); // Update the (biased=E+127) span
         // handleComponentsToDecimal32(); // Optionally trigger reverse calculation display
     }


    function handleComponentsToDecimal32() {
         // Reconstructs a 32-bit float from the interactive components
         if (currentPrecision !== '32') {
            displayComponentError("Интерактивный режим только для 32-бит.");
            return;
         }
        componentResultDiv.textContent = '';
        componentResultDiv.classList.remove('error');

        const { exponentBits, mantissaBits, bias } = params['32'];
        const signBit = parseInt(compSignSelect.value);
        const realExponentStr = compExponentInput.value; // E
        const mantissaValueStr = compMantissaInput.value.replace(/\s/g, ''); // M (без 1.)

        // --- Validation ---
        if (realExponentStr.trim() === '' ) {
             // Allow empty exponent for potential Inf/NaN reconstruction attempts
             // We'll rely on mantissa/special values later
        } else if (isNaN(parseInt(realExponentStr))) {
             displayComponentError("Неверное значение реальной экспоненты.");
             return;
         }

        if (!/^[01]*$/.test(mantissaValueStr) || mantissaValueStr.length > mantissaBits) {
             displayComponentError(`Неверный формат мантиссы (только 0 и 1, макс. ${mantissaBits} бит).`);
            return;
         }

        const mantissaPadded = mantissaValueStr.padEnd(mantissaBits, '0');

        // --- Determine Biased Exponent and Handle Special Cases ---
         let biasedExponent;
         let exponentBinStr;

         // Rough estimation based on E - needs refinement for exact edge cases
         const realExponent = parseInt(realExponentStr); // May be NaN if input was empty

        if (isNaN(realExponent)) {
            // If E is empty, maybe user intends Inf/NaN? Assume Inf for now if M=0, else NaN
             exponentBinStr = '1'.repeat(exponentBits); // All 1s
             biasedExponent = (1 << exponentBits) - 1;
        } else if (realExponent > bias) { // E > 127 => Likely Inf/NaN
             exponentBinStr = '1'.repeat(exponentBits); // All 1s
             biasedExponent = (1 << exponentBits) - 1;
         } else if (realExponent <= (1 - bias)) { // E <= -126 => Likely Zero/Denormalized
             exponentBinStr = '0'.repeat(exponentBits); // All 0s
             biasedExponent = 0;
             // Note: Precise denormalized reconstruction from E is tricky, DataView is better.
             // This path might not perfectly reconstruct denormalized from E + M.
         } else { // Normalized range
             biasedExponent = realExponent + bias;
             exponentBinStr = biasedExponent.toString(2).padStart(exponentBits, '0');
         }

        // --- Reconstruct using DataView ---
        const fullBitsStr = signBit.toString() + exponentBinStr + mantissaPadded;
        const fullBitsInt = parseInt(fullBitsStr, 2);

         try {
            const buffer = new ArrayBuffer(4);
             const view = new DataView(buffer);
             view.setUint32(0, fullBitsInt, false); // Write the bits
            const decimalResult = view.getFloat32(0, false); // Read back as float

             // Analyze the *resulting* bits to get the type accurately
             const finalExpBits = parseInt(exponentBinStr, 2);
             const finalMantZero = !mantissaPadded.includes('1');
             let type = 'Нормализованное';
             if(finalExpBits === 255) { type = finalMantZero ? 'Бесконечность' : 'NaN'; }
             else if (finalExpBits === 0) { type = finalMantZero ? 'Нуль' : 'Денормализованное'; }


            componentResultDiv.innerHTML = `Результат: <strong>${decimalResult}</strong> (${type})`;

         } catch (error) {
            console.error("Reconstruction Error:", error);
             displayComponentError(`Ошибка реконструкции: ${error.message}`);
         }
    }


}); // End DOMContentLoaded
