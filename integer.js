document.addEventListener('DOMContentLoaded', () => {
    const intInput = document.getElementById('int-input');
    const representBtn = document.getElementById('int-represent-btn');
    const representationOutput = document.getElementById('representation-output');

    const num1Input = document.getElementById('num1');
    const num2Input = document.getElementById('num2');
    const operationSelect = document.getElementById('operation');
    const calculateBtn = document.getElementById('calculate-btn');
    const arithmeticSteps = document.getElementById('arithmetic-steps');
    const overflowInfo = document.getElementById('overflow-info');

    const BITS = 8; // Работаем с 8 битами

    // --- Представление чисел ---
    representBtn.addEventListener('click', showRepresentations);
    intInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') showRepresentations();
    });

    function showRepresentations() {
        const decValue = parseInt(intInput.value);
        if (isNaN(decValue) || decValue < -128 || decValue > 127) {
            representationOutput.innerHTML = '<p style="color: red;">Введите целое число от -128 до 127.</p>';
            return;
        }

        const direct = getDirectCode(decValue, BITS);
        const ones = getOnesComplement(decValue, BITS);
        const twos = getTwosComplement(decValue, BITS);

        representationOutput.innerHTML = `
            <p>Число: <strong>${decValue}</strong></p>
            <p>Прямой код: <span class="code-bits">${formatBits(direct)}</span></p>
            <p>Обратный код: <span class="code-bits">${formatBits(ones)}</span></p>
            <p>Дополнительный код: <span class="code-bits">${formatBits(twos)}</span></p>
        `;
        representationOutput.classList.add('fade-in'); // Простая анимация
        setTimeout(() => representationOutput.classList.remove('fade-in'), 500);
    }

     // --- Арифметика ---
    calculateBtn.addEventListener('click', performArithmetic);
    // Можно добавить обработку Enter и для полей арифметики

    function performArithmetic() {
        const num1Dec = parseInt(num1Input.value);
        const num2Dec = parseInt(num2Input.value);
        const operation = operationSelect.value;

        // Валидация (упрощенная)
        if (isNaN(num1Dec) || isNaN(num2Dec) || num1Dec < -128 || num1Dec > 127 || num2Dec < -128 || num2Dec > 127) {
            arithmeticSteps.innerHTML = '<p style="color: red;">Введите числа от -128 до 127.</p>';
             overflowInfo.style.display = 'none';
            return;
        }

        // 1. Конвертация в Доп. код
        const num1Twos = getTwosComplement(num1Dec, BITS);
        let num2Twos;
        let opSymbol = '+';
        let originalNum2Sign = Math.sign(num2Dec);
        let num2ForOperation = num2Dec; // Число, которое будем складывать

        if (operation === 'add') {
            num2Twos = getTwosComplement(num2Dec, BITS);
            opSymbol = '+';
        } else { // subtract
            // Вычитание A - B это A + (-B)
            num2Twos = getTwosComplement(-num2Dec, BITS); // Берем доп. код от -num2
            opSymbol = '-';
             num2ForOperation = -num2Dec;
            // Коррекция для случая -(-128), который не представим как +128 в 8 битах
             if (num2Dec === -128) {
                 arithmeticSteps.innerHTML = `<p style="color: orange;">Вычитание -128 (${num2Dec}) эквивалентно прибавлению +128, что невозможно в 8-битном доп. коде.</p>`;
                 overflowInfo.style.display = 'none';
                return;
             }
        }

        // 2. Бинарное сложение
        const { sumBin, carryOut, carryIntoSign } = addBinary(num1Twos, num2Twos, BITS);

        // 3. Интерпретация результата
        const resultDec = binaryToDecimalTwos(sumBin, BITS);

        // 4. Проверка переполнения
        const { hasOverflow, reason } = checkOverflow(num1Dec, num2ForOperation, resultDec, carryIntoSign, carryOut);


        // 5. Вывод шагов
        let stepsHTML = `
            <p>Операция: ${num1Dec} ${opSymbol} ${num2Dec}</p>
            ${operation === 'subtract' ? `<p>Преобразуем в: ${num1Dec} + (${-num2Dec})</p>` : ''}
            <p>Число 1: ${num1Dec} ➔ Доп. код: <span class="code-bits">${formatBits(num1Twos)}</span></p>
            <p>Число 2: ${operation === 'add' ? num2Dec : `(${num2Dec})`} ➔ Доп. код ${operation === 'add' ? '' : 'для (-' + num2Dec + ')'}: <span class="code-bits">${formatBits(num2Twos)}</span></p>
            <hr>
            <p>Бинарное сложение:</p>
            <pre>
   ${formatBits(num1Twos)}  (${num1Dec})
+  ${formatBits(num2Twos)}  (${num2ForOperation})
--------------------
   ${formatBits(sumBin)}  (${resultDec})
            </pre>
            <p>Перенос из знакового разряда (Carry Out): ${carryOut}</p>
            <p><b>Результат (доп. код): <span class="code-bits">${formatBits(sumBin)}</span> ➔ Десятичный: ${resultDec}</b></p>
        `;

        arithmeticSteps.innerHTML = stepsHTML;
        arithmeticSteps.classList.add('fade-in');
        setTimeout(() => arithmeticSteps.classList.remove('fade-in'), 500);


        if (hasOverflow) {
            overflowInfo.innerHTML = `<strong>ВНИМАНИЕ: Произошло переполнение!</strong><br>${reason}`;
            overflowInfo.style.display = 'block';
            overflowInfo.classList.add('fade-in');
             setTimeout(() => overflowInfo.classList.remove('fade-in'), 500);
        } else {
            overflowInfo.style.display = 'none';
        }

    }

    // --- Вспомогательные функции для Целых ---

    function formatBits(binString) {
        // Добавляет пробелы для читаемости (например, каждые 4 бита)
         if (!binString || binString.length !== BITS) return binString; // Проверка
        if (BITS === 8) {
             return binString.substring(0,1) + ' ' + binString.substring(1, 4) + ' ' + binString.substring(4); // 1 111 1111
         } else if (BITS === 16) { // Пример для 16 бит
              return binString.substring(0,1) + ' ' + binString.substring(1, 8) + ' ' + binString.substring(8);
          }
        return binString; // Без форматирования для других разрядностей
    }

    function decToBinary(dec, bits) {
        // Простое преобразование положительного числа или нуля в двоичное представление заданной длины
        if (dec < 0) dec = 0; // Используется только для модуля
        let bin = dec.toString(2);
        while (bin.length < bits) {
            bin = '0' + bin;
        }
        return bin.slice(-bits); // Обрезаем до нужной длины, если нужно
    }

    function getDirectCode(dec, bits) {
        const absVal = Math.abs(dec);
        const magnitude = decToBinary(absVal, bits - 1); // Модуль занимает bits-1
        const signBit = dec < 0 ? '1' : '0';
        return signBit + magnitude;
    }

    function getOnesComplement(dec, bits) {
        if (dec >= 0) {
            return getDirectCode(dec, bits);
        } else {
            const absVal = Math.abs(dec);
            const magnitude = decToBinary(absVal, bits - 1);
            let invertedMagnitude = '';
            for (let i = 0; i < magnitude.length; i++) {
                invertedMagnitude += magnitude[i] === '0' ? '1' : '0';
            }
            return '1' + invertedMagnitude;
        }
    }

     function getTwosComplement(dec, bits) {
        if (dec >= 0) {
            return getDirectCode(dec, bits); // Для положительных совпадает с прямым
        } else {
            // Специальный случай для минимального числа (-128 для 8 бит)
             const minNeg = -Math.pow(2, bits - 1);
            if (dec === minNeg) {
                return '1' + '0'.repeat(bits - 1);
            }

            // Для остальных отрицательных: Обратный код + 1
             const absVal = Math.abs(dec);
             // 1. Представление положительного absVal
            let binAbs = decToBinary(absVal, bits);
            // 2. Инвертирование всех битов
             let inverted = '';
             for(let bit of binAbs) {
                 inverted += (bit === '0' ? '1' : '0');
             }
             // 3. Прибавление 1
             let carry = 1;
            let twosComp = '';
            for (let i = bits - 1; i >= 0; i--) {
                const bit = parseInt(inverted[i]);
                const sum = bit + carry;
                twosComp = (sum % 2) + twosComp;
                carry = Math.floor(sum / 2);
            }
            return twosComp;
        }
    }

     function addBinary(bin1, bin2, bits) {
        let sum = '';
        let carry = 0;
        let carryIntoSign = 0; // Перенос В знаковый разряд (для проверки переполнения)

        for (let i = bits - 1; i >= 0; i--) {
            const bit1 = parseInt(bin1[i]);
            const bit2 = parseInt(bin2[i]);
            const currentSum = bit1 + bit2 + carry;
            sum = (currentSum % 2) + sum;
             const previousCarry = carry;
            carry = Math.floor(currentSum / 2);

            // Запоминаем перенос В знаковый разряд (когда i=1, результат запишется в 0-й разряд)
            if (i === 1) {
                 carryIntoSign = carry;
            }
         }
        // carry - это перенос ИЗ знакового разряда
        return { sumBin: sum, carryOut: carry, carryIntoSign: carryIntoSign };
    }

    function binaryToDecimalTwos(bin, bits) {
        if (bin[0] === '0') {
            // Положительное число
            return parseInt(bin, 2);
        } else {
            // Отрицательное число
             // Обратный процесс:
             // 1. Вычесть 1
             let invertedPlus1 = bin;
             let borrowed = '';
             let carry = -1; // Начинаем с вычитания 1
             let subtracted = '';
             for(let i = bits-1; i>=0; i--) {
                 let bit = parseInt(invertedPlus1[i]);
                 let currentVal = bit + carry;
                 if(currentVal < 0) {
                     subtracted = '1' + subtracted;
                     carry = -1;
                 } else {
                     subtracted = (currentVal % 2) + subtracted;
                      carry = Math.floor(currentVal / 2);
                 }
             }
             // 2. Инвертировать биты
              let magnitudeBin = '';
             for(let bit of subtracted) {
                 magnitudeBin += (bit === '0' ? '1' : '0');
             }
             // 3. Преобразовать в десятичное и добавить минус
            return -parseInt(magnitudeBin, 2);

             /* // Альтернативный способ: Вычислить значение по весам
            let value = -parseInt(bin[0]) * Math.pow(2, bits - 1);
            for (let i = 1; i < bits; i++) {
                value += parseInt(bin[i]) * Math.pow(2, bits - 1 - i);
            }
            return value;
             */
        }
    }

    function checkOverflow(num1, num2, result, carryIn, carryOut) {
         let hasOverflow = false;
         let reason = "";

         // Правило 1: Знаки операндов и результата
         const sign1 = Math.sign(num1);
         const sign2 = Math.sign(num2);
         const signResult = Math.sign(result);
          // Math.sign(0) is 0. Treat 0 as positive for this check.
         const s1 = sign1 >= 0 ? 0 : 1; // 0 positive/zero, 1 negative
         const s2 = sign2 >= 0 ? 0 : 1;
         const sR = signResult >= 0 ? 0 : 1;

         if (s1 === s2 && s1 !== sR) { // Если знаки операндов одинаковы, но знак результата другой
             hasOverflow = true;
             reason = `Переполнение по знаку: (${num1} [${s1===0?'+':'-'}]) + (${num2} [${s2===0?'+':'-'}]) = ${result} [${sR===0?'+':'-'}]`;
         }

        // Правило 2: Переносы в/из знакового разряда
        if (carryIn !== carryOut) {
             hasOverflow = true; // Это должно совпадать с правилом 1
            let reasonCarry = `Переполнение по переносам: Перенос В знаковый бит (${carryIn}) != Перенос ИЗ знакового бита (${carryOut}).`;
            reason = reason ? reason + "<br>" + reasonCarry : reasonCarry; // Добавить или установить причину
         }

         // Особый случай добавления противоположных чисел (-128 + 128) - тут не бывает переполнения по этим правилам
         if(num1 === -num2 && num1 !== 0){
              // This might sometimes trigger carryIn !== carryOut rule, but isn't a true overflow
              // e.g. -1 + 1 = 0 (-1 is 11111111, 1 is 00000001)
              // 11111111 + 00000001 = (1)00000000. CarryIn=0, CarryOut=1. Result 0 is correct.
              // Let's refine: Overflow happens ONLY when adding two nums of the same sign results in a different sign.
             if (s1 === s2 && s1 !== sR) {
                 // Keep the overflow logic
             } else {
                  // Reset overflow if detected by carries for A + (-A) = 0
                  if(carryIn !== carryOut && result === 0 && s1 !== s2) {
                     hasOverflow = false;
                      reason = "";
                   }
              }
          }


         return { hasOverflow, reason };
    }

    // Инициализация при загрузке
     showRepresentations();
     // performArithmetic(); // Можно сразу выполнить вычисления с дефолтными значениями
});