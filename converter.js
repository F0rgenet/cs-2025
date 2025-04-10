document.addEventListener('DOMContentLoaded', () => {
    const convInput = document.getElementById('conv-input');
    const fromBaseSelect = document.getElementById('from-base');
    const toBaseSelect = document.getElementById('to-base');
    const convertBtn = document.getElementById('convert-btn');
    const resultValue = document.getElementById('result-value');
    const stepsList = document.getElementById('steps-list');

    convertBtn.addEventListener('click', performConversion);
    // Добавить обработку Enter для input
     convInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performConversion();
    });


    function performConversion() {
        const valueStr = convInput.value.trim().toUpperCase();
        const fromBase = parseInt(fromBaseSelect.value);
        const toBase = parseInt(toBaseSelect.value);
        stepsList.innerHTML = ''; // Очистить шаги
        resultValue.textContent = '---'; // Очистить результат

        if (!valueStr) {
            addStep('Ошибка: Введите число для конвертации.', true);
            return;
        }

        // 0. Валидация входного числа для исходной системы счисления
         const validChars = getValidChars(fromBase);
         if (!isValidNumberForBase(valueStr, validChars)) {
            addStep(`Ошибка: Число "${valueStr}" содержит недопустимые символы для системы счисления ${fromBase}. Допустимые: ${validChars}`, true);
             return;
         }


        try {
            let decimalValue;
            let processSteps = [];

            // 1. Если исходная система НЕ десятичная, перевести сначала в десятичную
            if (fromBase !== 10) {
                let conversionResult = convertToDecimal(valueStr, fromBase);
                decimalValue = conversionResult.decimalValue;
                 processSteps.push(...conversionResult.steps);
            } else {
                 // Проверить, что это действительно число
                 if (isNaN(parseFloat(valueStr))) throw new Error("Неверный формат десятичного числа.");
                decimalValue = parseFloat(valueStr); // Пока работаем только с целыми для простоты
                 processSteps.push({ text: `Исходное число: ${decimalValue} (База 10)` });
             }

            // 2. Если целевая система - десятичная, результат уже есть
            if (toBase === 10) {
                 resultValue.textContent = decimalValue.toString();
             }
             // 3. Если целевая НЕ десятичная, перевести из десятичной в целевую
             else {
                let conversionResult = convertFromDecimal(Math.trunc(decimalValue), toBase); // Работаем с целой частью
                resultValue.textContent = conversionResult.resultValue.toUpperCase();
                 processSteps.push(...conversionResult.steps);
                  // TODO: Добавить обработку дробной части, если нужно
             }

             // Отобразить шаги
            processSteps.forEach(step => addStep(step.text, step.isError));

        } catch (error) {
            console.error("Conversion error:", error);
            addStep(`Ошибка конвертации: ${error.message}`, true);
            resultValue.textContent = 'Ошибка';
        }
         stepsList.parentElement.classList.add('fade-in'); // Анимация
         setTimeout(() => stepsList.parentElement.classList.remove('fade-in'), 500);
    }

    function addStep(text, isError = false) {
        const li = document.createElement('li');
        li.innerHTML = text; // Используем innerHTML чтобы рендерить теги вроде <sup>
        if (isError) {
            li.style.color = 'red';
            li.style.fontWeight = 'bold';
        }
        stepsList.appendChild(li);
    }

     function getValidChars(base) {
         const digits = "0123456789ABCDEF";
         return digits.substring(0, base);
     }

    function isValidNumberForBase(valueStr, validChars) {
        // Простая проверка, не учитывает точку для дробных чисел
        for(let char of valueStr) {
            if (validChars.indexOf(char) === -1) {
                return false;
            }
        }
        return true;
     }

    // --- Функции конвертации ---

    function convertToDecimal(valueStr, fromBase) {
        let decimalValue = 0;
        let steps = [];
        steps.push({ text: `Перевод ${valueStr} (База ${fromBase}) в Десятичную (База 10):`});
        let power = 0;
        let calculationStr = [];

        for (let i = valueStr.length - 1; i >= 0; i--) {
            const char = valueStr[i];
            const digitValue = parseInt(char, fromBase); // Работает для 2-16 баз

            if (isNaN(digitValue)) {
                throw new Error(`Неверный символ '${char}' для базы ${fromBase}`);
            }

            const termValue = digitValue * Math.pow(fromBase, power);
             calculationStr.push(`${char}<sub>${fromBase}</sub> * ${fromBase}<sup>${power}</sup> (= ${termValue}<sub>10</sub>)`);
            decimalValue += termValue;
            steps.push({ text: `Цифра '${char}' (=${digitValue}<sub>10</sub>), позиция ${power}. Вклад: ${digitValue} * ${fromBase}<sup>${power}</sup> = ${termValue}`});
            power++;
        }
         steps.push({ text: `Суммируем: ${calculationStr.join(' + ')} = ${decimalValue}<sub>10</sub>` });
         steps.push({ text: `<b>Результат: ${valueStr}<sub>${fromBase}</sub> = ${decimalValue}<sub>10</sub></b>` });
        return { decimalValue, steps };
    }


     function convertFromDecimal(decValue, toBase) {
        if (decValue === 0) return { resultValue: "0", steps: [{ text: "0 в любой системе равен 0" }] };

        let resultValue = "";
        let originalValue = decValue; // Сохраним для вывода
        let steps = [];
        steps.push({ text: `Перевод ${decValue} (База 10) в Базу ${toBase}:`});
        steps.push({ text: `Делим целое число ${decValue} на основание ${toBase}, запоминаем остатки.` });

        while (decValue > 0) {
            const remainder = decValue % toBase;
            const quotient = Math.floor(decValue / toBase);
            let remainderStr = remainder.toString(toBase).toUpperCase(); // Для A-F

             steps.push({ text: `${decValue} / ${toBase} = ${quotient}, Остаток: ${remainder} (${remainderStr}<sub>${toBase}</sub>)`});

            resultValue = remainderStr + resultValue; // Добавляем остаток в начало строки
            decValue = quotient;
        }
        steps.push({ text: `Записываем остатки снизу вверх: ${resultValue}<sub>${toBase}</sub>` });
        steps.push({ text: `<b>Результат: ${originalValue}<sub>10</sub> = ${resultValue}<sub>${toBase}</sub></b>` });
        return { resultValue, steps };
    }

    // Инициализация при загрузке
    // performConversion(); // Можно сразу сконвертировать значение по умолчанию

});