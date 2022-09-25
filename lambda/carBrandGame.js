
const carList = require('./documents/carBrandCountryList.json');

const getRandomCar = function(pastCars = []) {
    const filtered = carList.filter(c => !pastCars.find(pc => pc.id === c.id));
    return filtered.length > 0
      ? filtered[Math.floor(Math.random() * filtered.length)]
      : {"id":0, "brand":null, "country_of_ori": null};
};
/**TEST
let pastCars = [{"id":1,"brand":"Audi","country_of_ori":["germany","german"]},{"id":2,"brand":"BMW","country_of_ori":["germany","german"]}];
console.log(getRandomCar(pastCars));*/

const checkAnswer = function(currentCar, userResponse) {
    const country = currentCar.country_of_ori;
    let checking = country.find(c => c === userResponse.toLowerCase());
    return checking ? true : false;
};
/**TEST
let currentCar = {"id":1,"brand":"Audi","country_of_ori":["germany","german"]};
console.log(checkAnswer(currentCar, 'german'));*/

const getHour = function(userTimeZone) {
const currentDateTime = new Date(new Date().toLocaleString("en-US", {timeZone: userTimeZone}));
return currentDateTime.getHours();
};

module.exports = {
getRandomCar,
checkAnswer,
getHour
};
