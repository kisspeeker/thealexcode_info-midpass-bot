package main

import (
	"encoding/json"
	"fmt"
	"github.com/Syfaro/telegram-bot-api"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"
)

type User struct {
	name    string
	allName string
	Numbers []string
	Percent []int
}

var tables = make(map[string]map[int]int)
var dates = make(map[string]map[int][]string)
var tablesOld = make(map[string]map[int]int)
var datesOld = make(map[string]map[int][]string)

type Number struct {
	beginNumber string
	reverse     bool
	countDays   int
}

var statisticsBool = false

func main() {
	// подключаемся к боту с помощью токена
	bot, err := tgbotapi.NewBotAPI("TOKEN")
	if err != nil {
		log.Panic(err)
	}

	ids := make(map[int]*User)

	ids = map[int]*User{
		12345: {
			name:    "vec",
			allName: "Alexey",
			Numbers: []string{"2000831032022101400008744"},
			Percent: []int{80},
		},
		552288667744: {
			"ntf",
			"­",
			[]string{"2000831032022110201900438"},
			[]int{30},
		},
		312424: {
			"",
			"...",
			[]string{"2000831032022101301900119", "2000831032022101300008734", "2000831032022101301900120"},
			[]int{80, 80, 100},
		},
	}

	bot.Debug = true
	log.Printf("Authorized on account %s", bot.Self.UserName)

	// инициализируем канал, куда будут прилетать обновления от API
	var ucfg tgbotapi.UpdateConfig = tgbotapi.NewUpdate(0)
	ucfg.Timeout = 60
	upd, _ := bot.GetUpdatesChan(ucfg)

	go func() {
		// Раз в час запускать проверку, через каждые 20 секунд каждого человека, при условии, что у него есть номера
		// Если у него проценты расходятся с тем, что хранится у него, то обновить значение, и отправить ему сообщении о смене процентов

		for {
			domen := "https://info.midpass.ru/api/request/"
			for id := range ids {
				if len(ids[id].Numbers) > 0 {
					for i, number := range ids[id].Numbers {
						link := domen + number
						if answer, err := ParseNumber(link); err == nil {
							if answer.InternalStatus.Percent != ids[id].Percent[i] {
								ids[id].Percent[i] = answer.InternalStatus.Percent

								msg := tgbotapi.NewMessage(
									int64(id),
									fmt.Sprintf("Статус обновился, стало %v%% по номеру *%v",
										ids[id].Percent[i], number[len(number)-4:]))
								bot.Send(msg)
								printInfo(ids)
							}
						}
						time.Sleep(20 * time.Second)
					}
				}
			}
			time.Sleep(30 * time.Minute)
		}
	}()

	go func() {
		// Каждую ночь собирается статистика

		for {
			if oldDayStatistics != today() {
				tablesOld = tables
				datesOld = dates

				tables = make(map[string]map[int]int)
				dates = make(map[string]map[int][]string)

				statisticsBool = false
				oldDayStatistics = today()
				cntDays := find10DaysAgo()

				getStatistics(
					"2000831032022092100008527",
					"2000831032022100601900006",
					cntDays)
			} else {
				fmt.Println(statisticsBool)
				fmt.Println(printTablesS(tables, dates, ""))
				fmt.Println()
				fmt.Println(tables)
				fmt.Println()
				fmt.Println(dates)
				fmt.Println()

				fmt.Println("statisticsBool")
				fmt.Println(printTablesS(tablesOld, datesOld, ""))
				fmt.Println()
				fmt.Println(tables)
				fmt.Println()
				fmt.Println(dates)
				fmt.Println()
				time.Sleep(50 * time.Minute)
			}
		}
	}()

	// читаем обновления из канала
	for {
		select {
		case update := <-upd:
			if update.Message == nil {
				continue
			}

			// Пользователь, который написал боту
			UserName := update.Message.From.UserName

			// ID чата/диалога.
			// Может быть идентификатором как чата с пользователем
			// (тогда он равен UserID) так и публичного чата/канала
			ChatID := update.Message.Chat.ID

			if ChatID == 12345 {
				//fmt.Println(update.Message.Text)
				//fmt.Println(strings.HasPrefix(update.Message.Text, "Обновить: *"))

				if !strings.HasPrefix(update.Message.Text, "Обновить: *") &&
					!(update.Message.Text == "-") && !(len(update.Message.Text) == 25) {
					if update.Message.ReplyToMessage == nil {
						sendTo := strings.Split(update.Message.Text, ":")
						if len(sendTo) == 0 {
							msg := tgbotapi.NewMessage(
								ChatID,
								fmt.Sprintf("%v - %v", "тут id либо нет, либо не разделён точками :(", sendTo))
							bot.Send(msg)
							break
						}
						ID, err := strconv.Atoi(sendTo[0])
						if err != nil {
							msg := tgbotapi.NewMessage(
								ChatID,
								fmt.Sprintf("%v - %v", "не распознал ID :(", sendTo))
							bot.Send(msg)
							break
						}

						msg := tgbotapi.NewMessage(
							int64(ID),
							fmt.Sprintf("%v", strings.TrimSpace(sendTo[1])))
						bot.Send(msg)

						break
					}

					sendTo, err := strconv.Atoi(update.Message.ReplyToMessage.Text)
					if err != nil {
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("%v - %v", "Не смог получить id :(", update.Message.ReplyToMessage.Text))
						bot.Send(msg)

						break
					}

					msg := tgbotapi.NewForward(int64(sendTo), ChatID, update.Message.MessageID)
					bot.Send(msg)

					//ID := int64(update.Message.ForwardFrom.ID)
					//fmt.Println(ID, 746200068)
					//msg := tgbotapi.NewForward(ID, 746200068, update.Message.MessageID)
					//bot.Send(msg)

					break
				}
			}

			// Текст сообщения
			Text := update.Message.Text

			log.Printf("[%s] %d %s", UserName, ChatID, Text)

			if reflect.TypeOf(update.Message.Text).Kind() == reflect.String && update.Message.Text != "" {
				switch {
				case Text == "/start":
					//Отправляем сообщение
					msg := tgbotapi.NewMessage(
						ChatID,
						fmt.Sprintf("Привет, @%s! Отправь мне, пожалуйста, свой номер заявления 10-го паспорта. "+
							"А я скажу, сколько процентов готово. И сообщу, когда проценты сменятся.", UserName))
					//
					if len(UserName) == 0 {
						msg = tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Привет, %s! Отправь мне, пожалуйста, свой номер заявления 10-го паспорта. "+
								"А я скажу, сколько процентов готово. И сообщу, когда проценты сменятся.", update.Message.From.FirstName))
					}
					msg.ReplyMarkup = updateNumericKeyboard(ids, update)
					bot.Send(msg)
				case Text == "-":
					if _, ok := ids[update.Message.From.ID]; !ok {
						break
					}
					deleteNumber := ""
					if len(ids[update.Message.From.ID].Numbers) > 0 {
						deleteNumber = ids[update.Message.From.ID].Numbers[len(ids[update.Message.From.ID].Numbers)-1]
						ids[update.Message.From.ID].Numbers = ids[update.Message.From.ID].Numbers[:len(ids[update.Message.From.ID].Numbers)-1]
						ids[update.Message.From.ID].Percent = ids[update.Message.From.ID].Percent[:len(ids[update.Message.From.ID].Percent)-1]
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Кнопка с номером заявления %v удалена.", deleteNumber))
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)
						printInfo(ids)
					} else {
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Кнопок нет."))
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)
					}

				case admin(update.Message.From.ID) && Text == "Статистика":
					stats := printTablesS(tables, dates, "")
					for _, state := range stats {
						msg := tgbotapi.NewMessage(
							ChatID,
							state)
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)
					}

				case strings.HasPrefix(Text, "Обновить"):
					if _, ok := ids[update.Message.From.ID]; !ok {
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Я потерял номер, пожалуйста, введи заново"))
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)
						break
					}
					find := false
					for _, number := range ids[update.Message.From.ID].Numbers {
						if strings.HasSuffix(number, Text[len(Text)-4:]) {
							Text = number
							find = true
							continue
						}
					}
					if !find {
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Я потерял номер, пожалуйста, введи заново"))
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)
						break
					}
					fallthrough
				default:
					if len(Text) != 25 {
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Я принимаю только 25-е числа :("))
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)

						msg = tgbotapi.NewMessage(
							12345,
							fmt.Sprintf("%v\n%v, %v, %v, %v",
								Text,
								update.Message.From.ID,
								update.Message.From.UserName,
								update.Message.From.FirstName,
								update.Message.From.LastName,
							))
						bot.Send(msg)

						msg2 := tgbotapi.NewForward(12345, ChatID, update.Message.MessageID)
						bot.Send(msg2)
						sendID := tgbotapi.NewMessage(
							12345,
							fmt.Sprintf("%v", ChatID))
						bot.Send(sendID)

						break
					}
					if _, err = strconv.Atoi(Text[:13]); err != nil {
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Я умею работать только с номером заявления :("))
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)

						msg = tgbotapi.NewMessage(
							12345,
							fmt.Sprintf("%v\n%v, %v, %v, %v",
								Text,
								update.Message.From.ID,
								update.Message.From.UserName,
								update.Message.From.FirstName,
								update.Message.From.LastName,
							))
						bot.Send(msg)

						msg2 := tgbotapi.NewForward(12345, ChatID, update.Message.MessageID)
						bot.Send(msg2)
						sendID := tgbotapi.NewMessage(
							12345,
							fmt.Sprintf("%v", ChatID))
						bot.Send(sendID)

						break
					}
					if _, err = strconv.Atoi(Text[13:]); err != nil {
						msg := tgbotapi.NewMessage(
							ChatID,
							fmt.Sprintf("Я умею работать только с номером заявления :("))
						msg.ReplyMarkup = updateNumericKeyboard(ids, update)
						bot.Send(msg)

						msg = tgbotapi.NewMessage(
							12345,
							fmt.Sprintf("%v\n%v, %v, %v, %v",
								Text,
								update.Message.From.ID,
								update.Message.From.UserName,
								update.Message.From.FirstName,
								update.Message.From.LastName,
							))
						bot.Send(msg)

						msg2 := tgbotapi.NewForward(12345, ChatID, update.Message.MessageID)
						bot.Send(msg2)
						sendID := tgbotapi.NewMessage(
							12345,
							fmt.Sprintf("%v", ChatID))
						bot.Send(sendID)

						break
					}
					domen := "https://info.midpass.ru/api/request/"
					link := domen + Text

					if answer, err := ParseNumber(link); err == nil {
						if _, ok := ids[update.Message.From.ID]; !ok {
							ids[update.Message.From.ID] = &User{
								name:    UserName,
								allName: update.Message.From.FirstName,
								Numbers: []string{Text},
								Percent: []int{answer.InternalStatus.Percent},
							}
						} else {
							ids[update.Message.From.ID].name = UserName
							ids[update.Message.From.ID].allName = update.Message.From.FirstName

							findIndex := -1

							for i, number := range ids[update.Message.From.ID].Numbers {
								if Text == number {
									findIndex = i
									break
								}
							}

							if findIndex != -1 {
								ids[update.Message.From.ID].Numbers[findIndex] = Text
								ids[update.Message.From.ID].Percent[findIndex] = answer.InternalStatus.Percent
							} else {
								if len(ids[update.Message.From.ID].Percent) >= 3 {
									ids[update.Message.From.ID].Numbers = ids[update.Message.From.ID].Numbers[1:]
									ids[update.Message.From.ID].Percent = ids[update.Message.From.ID].Percent[1:]
								}
								ids[update.Message.From.ID].Numbers = append(ids[update.Message.From.ID].Numbers, Text)
								ids[update.Message.From.ID].Percent = append(ids[update.Message.From.ID].Percent, answer.InternalStatus.Percent)
							}
						}

						fileName := fmt.Sprintf("%v.png", strconv.Itoa(answer.InternalStatus.Percent))
						data, err := ioutil.ReadFile(fileName)

						if err != nil {
							msg := tgbotapi.NewMessage(
								ChatID,
								fmt.Sprintf(
									"Готовность паспорта %v%%. %v, %v.",
									strconv.Itoa(answer.InternalStatus.Percent),
									answer.PassportStatus.Name,
									answer.InternalStatus.Name,
								))

							msg.ReplyMarkup = updateNumericKeyboard(ids, update)
							bot.Send(msg)
						} else {
							b := tgbotapi.FileBytes{Name: fileName, Bytes: data}

							msg := tgbotapi.NewPhotoUpload(ChatID, b)
							msg.Caption = fmt.Sprintf(
								"Готовность паспорта %v%%. %v, %v.",
								strconv.Itoa(answer.InternalStatus.Percent),
								answer.PassportStatus.Name,
								answer.InternalStatus.Name,
							)

							msg.ReplyMarkup = updateNumericKeyboard(ids, update)
							bot.Send(msg)
						}

						printInfo(ids)

					} else {

						if _, ok := ids[update.Message.From.ID]; !ok {
							ids[update.Message.From.ID] = &User{
								name:    UserName,
								allName: update.Message.From.FirstName,
								Numbers: []string{Text},
								Percent: []int{-5},
							}
						} else {
							ids[update.Message.From.ID].name = UserName
							ids[update.Message.From.ID].allName = update.Message.From.FirstName

							findIndex := -1

							for i, number := range ids[update.Message.From.ID].Numbers {
								if Text == number {
									findIndex = i
									break
								}
							}

							if findIndex != -1 {
								ids[update.Message.From.ID].Numbers[findIndex] = Text
								ids[update.Message.From.ID].Percent[findIndex] = -5
							} else {
								if len(ids[update.Message.From.ID].Percent) >= 3 {
									ids[update.Message.From.ID].Numbers = ids[update.Message.From.ID].Numbers[1:]
									ids[update.Message.From.ID].Percent = ids[update.Message.From.ID].Percent[1:]
								}
								ids[update.Message.From.ID].Numbers = append(ids[update.Message.From.ID].Numbers, Text)
								ids[update.Message.From.ID].Percent = append(ids[update.Message.From.ID].Percent, -5)
							}
						}

						if countDays(link) < 21 {
							msg := tgbotapi.NewMessage(
								ChatID,
								fmt.Sprintf("Информации пока нет, это нормально! Прошло немного времени с момента подачи."))
							msg.ReplyMarkup = updateNumericKeyboard(ids, update)
							bot.Send(msg)
						} else {
							msg := tgbotapi.NewMessage(
								ChatID,
								fmt.Sprintf("Информации пока нет, а точно верно введён номер заявления?"))
							msg.ReplyMarkup = updateNumericKeyboard(ids, update)
							bot.Send(msg)
						}
					}

				}
			} else {
				msg2 := tgbotapi.NewForward(12345, ChatID, update.Message.MessageID)
				bot.Send(msg2)
				sendID := tgbotapi.NewMessage(
					12345,
					fmt.Sprintf("%v", ChatID))
				bot.Send(sendID)
			}
		}
	}
}

func printInfo(ids map[int]*User) {
	initIds := "ids = map[int]*User{"

	keys := make([]int, 0, len(ids))
	for id, _ := range ids {
		keys = append(keys, id)
	}
	sort.Ints(keys)

	for _, id := range keys {
		if strings.HasSuffix(initIds, "\n}\n") {
			initIds = initIds[:len(initIds)-3]
		}
		numbersPrint := make([]string, len(ids[id].Numbers))
		for i, number := range ids[id].Numbers {
			numbersPrint[i] = "\"" + number + "\""
		}
		printNumbers := fmt.Sprintf("[]string{%v}", strings.Join(numbersPrint, ", "))
		percents := make([]string, len(ids[id].Percent))
		for i, percent := range ids[id].Percent {
			percents[i] = strconv.Itoa(percent)
		}
		printPercent := fmt.Sprintf("[]int{%v}", strings.Join(percents, ", "))

		initIds += fmt.Sprintf("\n%v: {\n\"%v\",\n\"%v\",\n%v,\n%v,\n},\n}\n",
			id, ids[id].name, ids[id].allName, printNumbers, printPercent)
	}

	initIds = initIds[:len(initIds)-1]
	fmt.Println(initIds)
	fmt.Println()

	for _, id := range keys {
		fmt.Println(fmt.Sprintf("%v, @%v, %v, %v - %v%%", id, ids[id].name, ids[id].allName, ids[id].Numbers, ids[id].Percent))
	}
	fmt.Println(len(ids))
}

func ParseNumber(link string) (*gg, error) {
	s, err := findLinks(link)
	if err != nil {
		return &gg{}, err
	}
	return &s, err
}

type InternalStatus struct {
	Name    string
	Percent int
}

type PassportStatus struct {
	Name string
}

type gg struct {
	ReceptionDate  string
	PassportStatus PassportStatus
	InternalStatus InternalStatus
}

func findLinks(url string) (myJsonString gg, err error) {
	//Подмена номера заявления, шутка
	//myNums := []string{"2000831032022092400007733"}
	//
	//for _, num := range myNums {
	//	if strings.HasSuffix(url, num) {
	//		url = url[:len(url) - len(num)] + "2000831032022093000008546"
	//	}
	//}

	resp, err := http.Get(url)
	if err != nil {
		return myJsonString, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return myJsonString, fmt.Errorf("getting %s: %s", url, resp.Status)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	err = json.Unmarshal(bodyBytes, &myJsonString)
	if err != nil {
		return myJsonString, fmt.Errorf("parsing %s as HTML: %v", url, err)
	}

	return myJsonString, nil
}

func countDays(url string) int {
	date := url[len(url)-16 : len(url)-8]

	year, _ := strconv.Atoi(date[:4])
	month, _ := strconv.Atoi(date[4:6])
	day, _ := strconv.Atoi(date[6:8])

	l, _ := time.LoadLocation("Europe/Vienna")

	t := time.Date(year, time.Month(month), day, 12, 12, 12, 0, l)

	dt := time.Now()
	return int(dt.Sub(t).Hours()) / 24
}

func admin(ID int) bool {
	adminIDs := [...]int{123, 12345, 643534, 45543}

	for _, adminID := range adminIDs {
		if ID == adminID {
			return true
		}
	}
	return false
}

func updateNumericKeyboard(ids map[int]*User, update tgbotapi.Update) (numericKeyboard interface{}) {
	if len(ids) == 0 {
		if admin(update.Message.From.ID) {
			return tgbotapi.NewReplyKeyboard(tgbotapi.NewKeyboardButtonRow(tgbotapi.NewKeyboardButton("Статистика")))
		}
		return tgbotapi.NewRemoveKeyboard(true)
	}
	if _, ok := ids[update.Message.From.ID]; !ok {
		ids[update.Message.From.ID] = &User{
			update.Message.From.UserName,
			update.Message.From.LastName,
			[]string{},
			[]int{},
		}
	}

	if len(ids[update.Message.From.ID].Numbers) == 0 {
		if admin(update.Message.From.ID) {
			return tgbotapi.NewReplyKeyboard(tgbotapi.NewKeyboardButtonRow(tgbotapi.NewKeyboardButton("Статистика")))
		}
		return tgbotapi.NewRemoveKeyboard(true)
	}

	number := make([]string, len(ids[update.Message.From.ID].Numbers))
	for i, num := range ids[update.Message.From.ID].Numbers {
		number[i] = num[len(num)-4:]
	}
	buttons := make([][]tgbotapi.KeyboardButton, len(number))
	for i, _ := range buttons {
		buttons[i] = tgbotapi.NewKeyboardButtonRow(tgbotapi.NewKeyboardButton(fmt.Sprintf("Обновить: *%v", number[i])))
	}

	if admin(update.Message.From.ID) {
		buttons = append(buttons, tgbotapi.NewKeyboardButtonRow(tgbotapi.NewKeyboardButton(fmt.Sprintf("Статистика"))))
	}

	numericKeyboard = tgbotapi.NewReplyKeyboard(buttons...)

	return numericKeyboard
}

var oldDayStatistics = ""

func find10DaysAgo() int {
	year := 2022
	month := 10
	day := 5

	l, _ := time.LoadLocation("Europe/Vienna")

	t := time.Date(year, time.Month(month), day, 12, 12, 12, 0, l)

	dt := time.Now()
	return int(dt.Sub(t).Hours())/24 - 10
}

const maxAttempts = 10
const sleep = 7777

func getStatistics(beginNumber, beginNumber19 string, countDaysInit int) {
	domen := "https://info.midpass.ru/api/request/"

	numbers := []Number{
		{beginNumber, false, countDaysInit + 15},
		{beginNumber19, false, countDaysInit},
	}

	sleepFail := time.Duration(1000)
	succsses := true
	for _, number := range numbers {
		link := domen + number.beginNumber
		n := 0
		cntDays := number.countDays
		oldSuccessLink := link

		for cntDays > 0 {
			for ; n < maxAttempts; link = nextNumber(link, number.reverse) {
				if succsses {
					time.Sleep(sleep * time.Millisecond)
				} else {
					time.Sleep(sleepFail * time.Millisecond)
				}

				_, _, err := addLink(tables, dates, link)

				if err != nil {
					n++
					succsses = false
					continue
				} else {
					n = 0
					succsses = true
				}

				oldSuccessLink = link
			}

			cntDays--
			link = link[:len(link)-lenNumber] + oldSuccessLink[len(link)-lenNumber:]
			link = nextDate(nextNumber(link, number.reverse), number.reverse)
			n = 0
		}
	}

	for _, indexes := range dates {
		for _, nums := range indexes {
			sort.Strings(nums)
		}
	}

	statisticsBool = true
}

const lenNumber = 5

func nextNumber(url string, reverse bool) string {
	res1 := url[:len(url)-lenNumber]
	res2, _ := strconv.Atoi(url[len(url)-lenNumber:])

	if !reverse {
		res2 += 1
	} else {
		res2 -= 1
	}

	return fmt.Sprintf("%v%0"+strconv.Itoa(lenNumber)+"d", res1, res2)
}

func nextDate(url string, reverse bool) string {
	res1 := url[:len(url)-16]
	date := url[len(url)-16 : len(url)-8]
	res3 := url[len(url)-8:]

	//fmt.Println(date)
	year, _ := strconv.Atoi(date[:4])
	month, _ := strconv.Atoi(date[4:6])
	day, _ := strconv.Atoi(date[6:8])

	l, _ := time.LoadLocation("Europe/Vienna")

	t := time.Date(year, time.Month(month), day, 12, 12, 12, 0, l)

	if !reverse {
		t = t.AddDate(0, 0, 1)
	} else {
		t = t.AddDate(0, 0, -1)
	}

	return fmt.Sprintf("%v%v%v", res1, t.Format("20060102"), res3)
}

func addLink(tables map[string]map[int]int, dates map[string]map[int][]string, link string) (string, int, error) {
	s, err := findLinks(link)
	if err != nil {
		return "", 0, err
	}
	if _, keyExist := tables[s.ReceptionDate]; keyExist {
		tables[s.ReceptionDate][s.InternalStatus.Percent]++
		tables[s.ReceptionDate][-1]++
	} else {
		tables[s.ReceptionDate] = make(map[int]int)
		tables[s.ReceptionDate][-1]++
		tables[s.ReceptionDate][s.InternalStatus.Percent]++
	}

	if len(dates[s.ReceptionDate]) == 0 {
		dates[s.ReceptionDate] = make(map[int][]string)
	}

	number := link[len(link)-25:]
	i := 0
	if number[18:20] == "19" {
		i = 1
	}

	dates[s.ReceptionDate][i] = append(dates[s.ReceptionDate][i], number)

	return s.ReceptionDate, s.InternalStatus.Percent, err
}

func printTablesS(tables map[string]map[int]int, dates map[string]map[int][]string, myDate string) []string {
	keys := make([]string, 0, len(tables))

	if myDate != "" {
		keys = append(keys, myDate)
	} else {
		for k := range tables {
			keys = append(keys, k)
		}
		sort.Sort(sort.Reverse(sort.StringSlice(keys)))
	}
	var printResult []string
	if statisticsBool {
		printResult = append(printResult, "Статистика актуальна на " + oldDayStatistics + ".")
	} else {
		printResult = append(printResult, "Статистика в процессе обновления данных на " + oldDayStatistics + ".")
		return []string{"Пока статистика загружается, на это требуется часа 4. " +
			"Вообще обновление статистики происходит один раз в день, начинается в полночь, но " +
			"пока я не реализовал сохранение статистики, а при перезапуске бота она стирается( скоро это починю."}
	}

	var old10Index int
	for i, v := range keys {
		if i%10 == 0 {
			printResult = append(printResult, "")
			old10Index = i/10 + 1
		}
		printResult[old10Index] += fmt.Sprintf("%v (%v чел.). Номера заявлений\n%v:\n", v, tables[v][-1],
			printDates(dates, v))

		keys2 := make([]int, 0, len(tables[v]))
		for i, _ := range tables[v] {
			keys2 = append(keys2, i)
		}
		sort.Ints(keys2)

		for _, v2 := range keys2 {
			if v2 != -1 {
				printResult[old10Index] += fmt.Sprintf("%v - %v\n", v2, tables[v][v2])
			}
		}

		printResult[old10Index] += "\n\n"
	}

	return printResult
}

func hhhhh(nm []string) ([2]string, error) {
	if len(nm) == 0 {
		return [2]string{}, fmt.Errorf("%v", "Размер массива должен быть больше нуля!")
	}
	sort.Strings(nm)
	return [2]string{nm[0], nm[len(nm)-1]}, nil
}

func printDates(d map[string]map[int][]string, key string) string {
	var result [][]string
	for index := range []int{0, 1} {
		if _, ok := d[key][index]; ok {
			if s, err := hhhhh(d[key][index]); err == nil {
				result = append(result, []string{s[0], s[1]})
			}
		}
	}

	format := [2]string{
		"с %v по %v",
		"\nи с %v по %v",
	}

	res := ""
	for i, mes := range result {
		res += fmt.Sprintf(format[i], mes[0], mes[1])
	}

	return res
}

func today() string {
	dt := time.Now().AddDate(0, 0, -1)
	return fmt.Sprintf("%v", dt.Format("02.01.2006"))
}
