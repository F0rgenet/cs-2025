document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const floatInput = document.getElementById('float-input');
    const representBtn = document.getElementById('float-represent-btn');
    const signBitDiv = document.getElementById('sign-bit');
    const exponentBitsDiv = document.getElementById('exponent-bits');
    const mantissaBitsDiv = document.getElementById('mantissa-bits');
    const floatDetailsDiv = document.getElementById('float-details');

    const compSignSelect = document.getElementById('float-s');
    const compExponentInput = document.getElementById('float-e');
    const compMantissaInput = document.getElementById('float-m');
    const calculateCompBtn = document.getElementById('calculate-from-components');
    const componentResultDiv = document.getElementById('component-result');
    const biasedExponentSpan = document.getElementById('biased-e-out');

    // --- Constants ---
    const EXPONENT_BITS = 8;
    const MANTISSA_BITS = 23;
    const BIAS = 127; // For 32-bit float (2^(8-1) - 1)

    // --- Event Listeners ---
    representBtn.addEventListener('click', handleDecimalToFloat);
    floatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleDecimalToFloat();
    });

    calculateCompBtn.addEventListener('click', handleComponentsToDecimal);
    compExponentInput.addEventListener('input', updateBiasedExponentDisplay);

    // --- Initialization ---
    handleDecimalToFloat(); // Run with default value on load
    updateBiasedExponentDisplay(); // Update biased E display for default E value

    // --- Main Handlers ---

    function handleDecimalToFloat() {
        clearPreviousResults();
        const decimalValueStr = floatInput.value;
        let decimalValue = parseFloat(decimalValueStr);

        if (isNaN(decimalValue)) {
            displayError("Неверный формат десятичного числа.");
            return;
        }

        const { sign, exponentBits, mantissaBits, details } = decimalToFloat32(decimalValue);

        displayFloatRepresentation(sign, exponentBits, mantissaBits, details);
        updateInteractiveComponents(sign, exponentBits, mantissaBits, decimalValue);
    }

    function handleComponentsToDecimal() {
        componentResultDiv.textContent = '';
        componentResultDiv.classList.remove('error');

        const signBit = parseInt(compSignSelect.value);
        const realExponent = parseInt(compExponentInput.value); // E
        const mantissaValueStr = compMantissaInput.value.replace(/\s/g, ''); // M (без 1.)

         // Basic Validation
        if (isNaN(realExponent)) {
            displayComponentError("Неверное значение реальной экспоненты.");
            return;
         }
        if (!/^[01]*$/.test(mantissaValueStr) || mantissaValueStr.length > MANTISSA_BITS) {
             displayComponentError(`Неверный формат мантиссы (только 0 и 1, макс. ${MANTISSA_BITS} бит).`);
            return;
         }

         const mantissaPadded = mantissaValueStr.padEnd(MANTISSA_BITS, '0'); // Дополнить нулями справа

        // Calculate Biased Exponent for standard checks
        let biasedExponent = realExponent + BIAS;
         let exponentBits;

         // Special cases determination based on desired E (relative to bias limits)
         if (realExponent > BIAS) { // E > 127 => biased E >= 255
              exponentBits = '1'.repeat(EXPONENT_BITS); // Infinity / NaN pattern
         } else if (realExponent <= -BIAS) { // E <= -127 => biased E <= 0
             exponentBits = '0'.repeat(EXPONENT_BITS); // Zero / Denormalized pattern
         } else {
              exponentBits = (biasedExponent).toString(2).padStart(EXPONENT_BITS, '0');
          }

          // Use the derived bits to reconstruct
         try {
             const decimalResult = float32ToDecimal(signBit, exponentBits, mantissaPadded);
             componentResultDiv.innerHTML = `Результат: <strong>${decimalResult.valueStr}</strong> (${decimalResult.type})`;
          } catch (error) {
             displayComponentError(`Ошибка реконструкции: ${error.message}`);
          }

    }

    // --- Conversion Logic ---

    function decimalToFloat32(decValue) {
        let sign = (Object.is(decValue, -0) || decValue < 0) ? 1 : 0; // Handle -0 correctly

        // --- Handle Zero ---
        if (decValue === 0 || Object.is(decValue, -0)) {
            return {
                sign: sign,
                exponentBits: '0'.repeat(EXPONENT_BITS),
                mantissaBits: '0'.repeat(MANTISSA_BITS),
                details: `Число: ${decValue}<br>Тип: Нуль`
            };
        }

        // --- Handle Infinity and NaN ---
         if (!isFinite(decValue)) {
            const isNaNValue = isNaN(decValue);
            return {
                 sign: isNaNValue ? 0 : (decValue < 0 ? 1 : 0), // NaN usually has sign 0, Inf keeps its sign
                 exponentBits: '1'.repeat(EXPONENT_BITS),
                 mantissaBits: isNaNValue ? ('1' + '0'.repeat(MANTISSA_BITS - 1)) : '0'.repeat(MANTISSA_BITS), // Basic NaN pattern
                 details: `Число: ${decValue}<br>Тип: ${isNaNValue ? 'NaN (Не число)' : 'Бесконечность'}`
            };
         }

        let absValue = Math.abs(decValue);
        let exponent = Math.floor(Math.log2(absValue));
        let mantissa = (absValue / Math.pow(2, exponent)) - 1; // Calculate (Value / 2^E) - 1 to get the fractional part after '1.'

        // --- Handle Denormalized (Subnormal) Numbers ---
         // If the exponent is too small for normal representation
        if (exponent < (1 - BIAS)) { // 1 - 127 = -126
             // Recalculate mantissa based on the smallest possible exponent (-126)
             // Value = 0.M * 2^(-126) => M_value = Value / 2^(-126) = Value * 2^126
            mantissa = absValue * Math.pow(2, BIAS - 1); // = Value * 2^126
            exponent = 1 - BIAS; // Effective exponent for calculation is fixed
            // Exponent bits will be all zeros
             let exponentBits = '0'.repeat(EXPONENT_BITS);
             let mantissaFractionalStr = decimalFractionToBinary(mantissa, MANTISSA_BITS);
             let mantissaBits = mantissaFractionalStr.padEnd(MANTISSA_BITS, '0').substring(0, MANTISSA_BITS); // Ensure length, may truncate

              return {
                 sign: sign,
                 exponentBits: exponentBits,
                 mantissaBits: mantissaBits,
                 details: `Число: ${decValue.toExponential()}<br>
                           Тип: <b>Денормализованное число</b><br>
                           Реальная экспонента (E): ${exponent} (-126)<br>
                           Формула: (-1)^${sign} * 0.${mantissaBits} * 2<sup>-126</sup>`
             };
         }

         // --- Handle Potential Overflow to Infinity during calculation ---
         // This check comes AFTER denormalized check
         if (exponent > (Math.pow(2, EXPONENT_BITS) - 2 - BIAS)) { // Max normal exponent E_max = 254-127 = 127
            // Exponent is too large for normal representation, treat as Infinity
             return {
                 sign: sign,
                 exponentBits: '1'.repeat(EXPONENT_BITS),
                 mantissaBits: '0'.repeat(MANTISSA_BITS),
                 details: `Число: ${decValue.toExponential()}<br>Тип: <b>Бесконечность</b> (переполнение)`
             };
         }


        // --- Normalized Number Calculation ---
        let biasedExponent = exponent + BIAS;
        let exponentBits = biasedExponent.toString(2).padStart(EXPONENT_BITS, '0');

        // Convert the calculated mantissa fraction to binary
        let mantissaBinary = decimalFractionToBinary(mantissa, MANTISSA_BITS + 1); // Calculate one extra bit for potential rounding

        // Basic rounding (round half up) - simplistic, IEEE 754 uses round-to-nearest-even
        let mantissaBits;
        if (mantissaBinary.length > MANTISSA_BITS) {
            if (mantissaBinary[MANTISSA_BITS] === '1') {
                // Need to round up: effectively add 1 to the 23-bit mantissa
                let mantissaInt = parseInt(mantissaBinary.substring(0, MANTISSA_BITS), 2);
                if (isNaN(mantissaInt)) mantissaInt = 0; // Safety
                mantissaInt += 1;

                // Check if rounding caused overflow in mantissa, needing exponent adjustment
                if (mantissaInt >= Math.pow(2, MANTISSA_BITS)) {
                    mantissaInt = 0; // Mantissa becomes all zeros
                    biasedExponent += 1; // Increment exponent
                    // Re-check for overflow to infinity after rounding
                     if (biasedExponent >= (Math.pow(2, EXPONENT_BITS) - 1)) { // 255
                        return {
                             sign: sign,
                             exponentBits: '1'.repeat(EXPONENT_BITS),
                             mantissaBits: '0'.repeat(MANTISSA_BITS),
                             details: `Число: ${decValue.toExponential()}<br>Тип: <b>Бесконечность</b> (переполнение при округлении)`
                        };
                    }
                     exponentBits = biasedExponent.toString(2).padStart(EXPONENT_BITS, '0');
                 }
                 mantissaBits = mantissaInt.toString(2).padStart(MANTISSA_BITS, '0');
            } else {
                 mantissaBits = mantissaBinary.substring(0, MANTISSA_BITS).padEnd(MANTISSA_BITS, '0'); // Truncate if no rounding
             }
        } else {
            mantissaBits = mantissaBinary.padEnd(MANTISSA_BITS, '0'); // Pad if shorter
        }


        return {
            sign: sign,
            exponentBits: exponentBits,
            mantissaBits: mantissaBits,
            details: `Число: ${decValue}<br>
                      Тип: Нормализованное число<br>
                      Знак (S): ${sign}<br>
                      Реальная экспонента (E): ${exponent} ( = ${biasedExponent} - ${BIAS} )<br>
                      Смещенная экспонента (E_biased): ${biasedExponent} = <span>${formatBits(exponentBits, EXPONENT_BITS)}</span><sub>2</sub><br>
                      Мантисса (M): ${formatBits(mantissaBits, MANTISSA_BITS)}<br>
                      Нормализованный вид: (-1)^${sign} * 1.${mantissaBits} * 2<sup>${exponent}</sup>`
        };
    }


     // Helper to convert the fractional part of a decimal to binary string
    function decimalFractionToBinary(fraction, precision) {
        if (fraction === 0) return "";
        let binary = "";
        while (fraction > 0 && binary.length < precision) {
            fraction *= 2;
            if (fraction >= 1) {
                binary += "1";
                fraction -= 1;
            } else {
                binary += "0";
            }
        }
        return binary;
    }


    function float32ToDecimal(signBit, exponentBits, mantissaBits) {
        signBit = parseInt(signBit); // Ensure number
        const biasedExponent = parseInt(exponentBits, 2);
        const mantissaValueStr = mantissaBits.replace(/\s/g,''); // Clean string

         // --- Special Cases based on Exponent Bits ---
        const allExpBitsOne = !exponentBits.includes('0');
        const allExpBitsZero = !exponentBits.includes('1');
        const allMantBitsZero = !mantissaValueStr.includes('1');

        if (allExpBitsOne) {
             if (allMantBitsZero) {
                 return { valueStr: (signBit === 0 ? '+' : '-') + 'Infinity', type: 'Бесконечность' };
             } else {
                 return { valueStr: 'NaN', type: 'NaN (Не число)' };
            }
         }

         if (allExpBitsZero) {
            if (allMantBitsZero) {
                return { valueStr: (signBit === 0 ? '0' : '-0'), type: 'Нуль' };
            } else {
                 // --- Denormalized ---
                const exponent = 1 - BIAS; // Fixed exponent (-126)
                 let mantissaDecimal = binaryFractionToDecimal(mantissaValueStr); // Value of 0.M
                // Avoid precision issues by calculating using powers if possible, or use Number for simplicity
                let value = (signBit === 1 ? -1 : 1) * mantissaDecimal * Math.pow(2, exponent);
                 return { valueStr: value.toExponential(), type: 'Денормализованное' }; // Use exponential form for small numbers
             }
        }

         // --- Normalized ---
        const exponent = biasedExponent - BIAS;
        let mantissaDecimal = binaryFractionToDecimal(mantissaValueStr); // Value of 0.M
        let value = (signBit === 1 ? -1 : 1) * (1 + mantissaDecimal) * Math.pow(2, exponent);

         return { valueStr: value.toString(), type: 'Нормализованное' }; // Standard decimal representation
     }

    // Helper to convert binary fraction string (like "101") to its decimal value (0.101_2)
    function binaryFractionToDecimal(binaryStr) {
         let decimalValue = 0;
         for (let i = 0; i < binaryStr.length; i++) {
             if (binaryStr[i] === '1') {
                decimalValue += Math.pow(2, -(i + 1));
             }
         }
         return decimalValue;
     }

    // --- DOM Update Functions ---
    function displayFloatRepresentation(sign, expBits, mantBits, detailsHTML) {
         // Use requestAnimationFrame for potentially smoother visual updates
         requestAnimationFrame(() => {
            signBitDiv.textContent = sign;
             signBitDiv.style.backgroundColor = sign === 1 ? '#f2dede' : '#dff0d8'; // Reddish / Greenish

            exponentBitsDiv.innerHTML = formatBits(expBits, EXPONENT_BITS);
             mantissaBitsDiv.innerHTML = formatBits(mantBits, MANTISSA_BITS);

             floatDetailsDiv.innerHTML = detailsHTML;

            // Add animation class
             const elementsToAnimate = [signBitDiv, exponentBitsDiv, mantissaBitsDiv, floatDetailsDiv];
            elementsToAnimate.forEach(el => el.closest('.bit-group, .output-area')?.classList.add('fade-in'));

            // Remove animation class after animation duration
             setTimeout(() => {
                elementsToAnimate.forEach(el => el.closest('.bit-group, .output-area')?.classList.remove('fade-in'));
             }, 500); // Match CSS animation duration
         });
     }

    function formatBits(bits, totalBits) {
         if (!bits || bits.length !== totalBits) return bits; // Basic check
         let formatted = '';
        if (totalBits === EXPONENT_BITS) { // 8 bits -> xxxx xxxx
            formatted = bits.substring(0, 4) + ' ' + bits.substring(4);
         } else if (totalBits === MANTISSA_BITS) { // 23 bits -> xxxx xxxx xxxx xxxx xxxx xxx
            for (let i = 0; i < bits.length; i += 4) {
                formatted += bits.substring(i, Math.min(i + 4, bits.length)) + ' ';
             }
            formatted = formatted.trim(); // Remove trailing space
         } else {
             formatted = bits; // Default for others
         }
        // Wrap each bit (or group) in a span for potential styling
        return `<span>${formatted.replace(/ /g, '</span> <span>')}</span>`;
     }


    function clearPreviousResults() {
        signBitDiv.textContent = '?';
        exponentBitsDiv.textContent = '?'.repeat(EXPONENT_BITS);
        mantissaBitsDiv.textContent = '?'.repeat(MANTISSA_BITS);
        floatDetailsDiv.innerHTML = '';
        componentResultDiv.textContent = '';
         signBitDiv.style.backgroundColor = ''; // Reset background
    }

     function displayError(message) {
        floatDetailsDiv.innerHTML = `<p style="color: red;">${message}</p>`;
        signBitDiv.textContent = 'E';
        exponentBitsDiv.textContent = 'ERR';
        mantissaBitsDiv.textContent = 'ERROR';
     }
    function displayComponentError(message) {
         componentResultDiv.innerHTML = `<span style="color: red;">${message}</span>`;
        componentResultDiv.classList.add('error');
    }

    function updateBiasedExponentDisplay() {
        const realE = parseInt(compExponentInput.value);
        if (!isNaN(realE)) {
             biasedExponentSpan.textContent = realE + BIAS;
         } else {
            biasedExponentSpan.textContent = '---';
         }
     }

     function updateInteractiveComponents(sign, expBits, mantBits, originalDecimal) {
        // Update the lower interactive part based on the result from the upper part
         compSignSelect.value = sign;

         // Calculate real exponent from bits (handle special cases first)
         const biasedExponent = parseInt(expBits, 2);
         let realExponent;
         if (biasedExponent === 0) { // Zero or Denormalized
             // Estimate the original intended exponent for denormalized if possible, or use default exponent
            if (originalDecimal !== 0 && !Object.is(originalDecimal, -0) && !mantBits.includes('1')) { // Non-zero, but represented as 0. Should not happen here based on checks above
                realExponent = ''; // Cannot determine easily
             }
              else if (originalDecimal === 0 || Object.is(originalDecimal,-0) || mantBits.includes('1')) { // Actually zero or Denormalized
                realExponent = 1 - BIAS; // -126
            }

         } else if (biasedExponent === 255) { // Infinity or NaN
            // No single real exponent represents these
             // Could set to max/min representable or leave blank/message?
             // Setting based on original might be misleading as it resulted in Inf/NaN
             realExponent = originalDecimal > 0 ? BIAS : -BIAS ; // Suggest +/- 127 as boundary maybe? Or empty?
            if(isNaN(originalDecimal)) realExponent = '' // NaN
             else realExponent = originalDecimal > 0 ? 128 : -128; // Show out of bound value ? Better leave as string info ?

         } else { // Normalized
            realExponent = biasedExponent - BIAS;
         }

        compExponentInput.value = isFinite(realExponent) ? realExponent : ''; // Don't put Infinity/NaN in number input
        compMantissaInput.value = mantBits; // Directly use the mantissa bits

        updateBiasedExponentDisplay(); // Update the calculated biased E span
        handleComponentsToDecimal(); // Trigger the reverse calculation display for consistency
     }

}); // End DOMContentLoaded