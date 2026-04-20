import WidgetKit
import SwiftUI
import UIKit

// MARK: - Constants

private let navyColor   = Color(red: 0.008, green: 0.008, blue: 0.208) // #020255
private let yellowColor = Color(red: 0.996, green: 0.741, blue: 0.008) // #FEBD02

private let venueShort: [String: String] = [
    "Brands Hatch Indy": "BHI", "Brands Hatch GP": "BHGP", "Brands Hatch": "BH",
    "Donington Park": "DON",    "Donington Park GP": "DPGP",
    "Thruxton": "THR",          "Oulton Park": "OUL",
    "Croft": "CRO",             "Snetterton": "SNE",
    "Knockhill": "KNO",         "Silverstone": "SIL",
]

// MARK: - Models

struct SessionInfo: Identifiable {
    let id = UUID()
    let name: String
    let day: String  // "SAT" or "SUN"
    let time: String
}

struct RoundInfo {
    let venue: String
    let startDate: Date
    let endDate: Date
    let dateRange: String
    let roundStart: Int
    let roundEnd: Int
    let sessions: [SessionInfo]
    let lat: Double
    let lng: Double
    let layoutImageUrl: String?
    let lengthMiles: String?
    let corners: Int?
    let lapRecordTime: String?
    let lapRecordDriver: String?
    let lapRecordYear: Int?

    var shortVenue: String { venueShort[venue] ?? String(venue.prefix(3)).uppercased() }

    var daysToGo: Int {
        let cal = Calendar.current
        return cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: startDate)).day ?? 0
    }

    var isRaceWeekend: Bool {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        return today >= cal.startOfDay(for: startDate) && today <= cal.startOfDay(for: endDate)
    }
}

struct WeatherDay {
    let date: Date
    let tempMax: Int
    let precipProb: Int
    let weatherCode: Int

    var emoji: String {
        switch weatherCode {
        case 0, 1:              return "☀️"
        case 2:                 return "⛅️"
        case 3:                 return "☁️"
        case 45, 48:            return "🌫"
        case 51...67, 80...82:  return "🌧"
        case 71...77:           return "❄️"
        case 95...99:           return "⛈"
        default:                return "☁️"
        }
    }

    var summary: String {
        let rain = precipProb > 0 ? " · \(precipProb)%" : ""
        return "\(emoji) \(tempMax)°\(rain)"
    }
}

// MARK: - Timeline Entry

struct BTCCEntry: TimelineEntry {
    let date: Date
    let round: RoundInfo?
    let weather: [WeatherDay]
    let layoutImage: UIImage?
}

// MARK: - JSON Parsing

private let dateFmt: DateFormatter = {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_GB"); return f
}()
private let dayFmt: DateFormatter = {
    let f = DateFormatter(); f.dateFormat = "d"; return f
}()
private let monthYearFmt: DateFormatter = {
    let f = DateFormatter(); f.dateFormat = "MMM yyyy"; f.locale = Locale(identifier: "en_GB"); return f
}()

private func parseCalendar(_ data: Data) -> RoundInfo? {
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let rounds = json["rounds"] as? [[String: Any]] else { return nil }
    let today = Calendar.current.startOfDay(for: Date())
    for r in rounds {
        guard let endStr   = r["endDate"]   as? String, let endDate   = dateFmt.date(from: endStr),
              let startStr = r["startDate"] as? String, let startDate = dateFmt.date(from: startStr),
              Calendar.current.startOfDay(for: endDate) >= today else { continue }
        let venue  = r["venue"] as? String ?? ""
        let round  = r["round"] as? Int ?? 1
        let rs     = (round - 1) * 3 + 1
        let sessArr = r["sessions"] as? [[String: Any]] ?? []
        let sessions = sessArr.map {
            SessionInfo(name: $0["name"] as? String ?? "", day: $0["day"] as? String ?? "", time: $0["time"] as? String ?? "TBA")
        }
        let dateRange = "\(dayFmt.string(from: startDate)) - \(dayFmt.string(from: endDate)) \(monthYearFmt.string(from: endDate))"
        let raceRec = r["raceRecord"] as? [String: Any]
        return RoundInfo(venue: venue, startDate: startDate, endDate: endDate, dateRange: dateRange,
                         roundStart: rs, roundEnd: rs + 2, sessions: sessions,
                         lat: r["lat"] as? Double ?? 0, lng: r["lng"] as? Double ?? 0,
                         layoutImageUrl: r["layoutImageUrl"] as? String,
                         lengthMiles: r["lengthMiles"] as? String,
                         corners: r["corners"] as? Int,
                         lapRecordTime: raceRec?["time"] as? String,
                         lapRecordDriver: raceRec?["driver"] as? String,
                         lapRecordYear: raceRec?["year"] as? Int)
    }
    return nil
}

private func fetchWeather(lat: Double, lng: Double, start: Date, end: Date, completion: @escaping ([WeatherDay]) -> Void) {
    let s = dateFmt.string(from: start); let e = dateFmt.string(from: end)
    let urlStr = "https://api.open-meteo.com/v1/forecast?latitude=\(lat)&longitude=\(lng)&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=Europe/London&start_date=\(s)&end_date=\(e)"
    guard let url = URL(string: urlStr) else { completion([]); return }
    URLSession.shared.dataTask(with: url) { data, _, _ in
        guard let data = data,
              let json    = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let daily   = json["daily"] as? [String: Any],
              let times   = daily["time"] as? [String],
              let codes   = daily["weather_code"] as? [Int] else { completion([]); return }
        let temps   = (daily["temperature_2m_max"]             as? [Double]) ?? []
        let precips = (daily["precipitation_probability_max"]  as? [Int])    ?? []
        let days = times.enumerated().compactMap { i, t -> WeatherDay? in
            guard let d = dateFmt.date(from: t) else { return nil }
            return WeatherDay(date: d, tempMax: i < temps.count ? Int(temps[i]) : 0,
                              precipProb: i < precips.count ? precips[i] : 0,
                              weatherCode: i < codes.count ? codes[i] : 0)
        }
        completion(days)
    }.resume()
}

// MARK: - Timeline Provider

struct BTCCProvider: TimelineProvider {
    func placeholder(in context: Context) -> BTCCEntry { BTCCEntry(date: Date(), round: nil, weather: [], layoutImage: nil) }

    func getSnapshot(in context: Context, completion: @escaping (BTCCEntry) -> Void) {
        loadEntry(completion: completion)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BTCCEntry>) -> Void) {
        loadEntry { entry in
            let refresh = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
            completion(Timeline(entries: [entry], policy: .after(refresh)))
        }
    }

    private func loadEntry(completion: @escaping (BTCCEntry) -> Void) {
        guard let url = URL(string: "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json") else {
            completion(BTCCEntry(date: Date(), round: nil, weather: [], layoutImage: nil)); return
        }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            let round = data.flatMap { parseCalendar($0) }
            guard let r = round else {
                completion(BTCCEntry(date: Date(), round: round, weather: [], layoutImage: nil)); return
            }
            let days = Calendar.current.dateComponents([.day], from: Date(), to: r.startDate).day ?? 999
            let fetchWeatherAndFinish = { (layoutImage: UIImage?) in
                guard r.lat != 0, days <= 16 else {
                    completion(BTCCEntry(date: Date(), round: round, weather: [], layoutImage: layoutImage)); return
                }
                fetchWeather(lat: r.lat, lng: r.lng, start: r.startDate, end: r.endDate) { weather in
                    completion(BTCCEntry(date: Date(), round: round, weather: weather, layoutImage: layoutImage))
                }
            }
            if let imgUrlStr = r.layoutImageUrl, let imgUrl = URL(string: imgUrlStr) {
                URLSession.shared.dataTask(with: imgUrl) { imgData, _, _ in
                    let image = imgData.flatMap { UIImage(data: $0) }
                    fetchWeatherAndFinish(image)
                }.resume()
            } else {
                fetchWeatherAndFinish(nil)
            }
        }.resume()
    }
}

// MARK: - Small Widget View

struct SmallView: View {
    let entry: BTCCEntry

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                if let r = entry.round {
                    if r.isRaceWeekend {
                        Text("LIVE")
                            .font(.system(size: 34, weight: .black))
                            .foregroundColor(yellowColor)
                    } else {
                        let d = r.daysToGo
                        Text(d <= 0 ? "NOW" : "\(d)")
                            .font(.system(size: 34, weight: .black))
                            .foregroundColor(yellowColor)
                        if d > 0 {
                            Text(d == 1 ? "DAY" : "DAYS")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.white.opacity(0.65))
                        }
                    }
                    Spacer()
                    Text(r.shortVenue)
                        .font(.system(size: 13, weight: .black))
                        .foregroundColor(.white)
                } else {
                    Text("--")
                        .font(.system(size: 34, weight: .black))
                        .foregroundColor(yellowColor)
                    Spacer()
                    Text("BTCC")
                        .font(.system(size: 13, weight: .black))
                        .foregroundColor(.white)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            Rectangle().fill(yellowColor).frame(height: 3)
        }
    }
}

// MARK: - Medium Widget View

struct MediumView: View {
    let entry: BTCCEntry

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 0) {
                // Countdown
                VStack(spacing: 2) {
                    if let r = entry.round {
                        if r.isRaceWeekend {
                            Text("RACE").font(.system(size: 18, weight: .black)).foregroundColor(yellowColor)
                            Text("WEEKEND").font(.system(size: 8, weight: .bold)).foregroundColor(.white.opacity(0.65))
                        } else {
                            let d = r.daysToGo
                            Text(d <= 0 ? "TODAY" : "\(d)").font(.system(size: 26, weight: .black)).foregroundColor(yellowColor)
                            Text(d <= 0 ? "" : (d == 1 ? "DAY\nTO GO" : "DAYS\nTO GO"))
                                .font(.system(size: 8, weight: .bold))
                                .multilineTextAlignment(.center)
                                .foregroundColor(.white.opacity(0.65))
                        }
                    } else {
                        Text("--").font(.system(size: 26, weight: .black)).foregroundColor(yellowColor)
                    }
                }
                .frame(width: 76)

                Rectangle().fill(Color.white.opacity(0.15)).frame(width: 1, height: 56)

                // Info
                VStack(alignment: .leading, spacing: 4) {
                    if let r = entry.round {
                        Text("ROUNDS \(r.roundStart)–\(r.roundEnd) · NEXT RACE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white.opacity(0.55))
                        Text(r.venue)
                            .font(.system(size: 15, weight: .black))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text(r.dateRange)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.7))
                    } else {
                        Text("BTCC 2026").font(.system(size: 15, weight: .black)).foregroundColor(.white)
                        Text("No upcoming rounds").font(.system(size: 12)).foregroundColor(.white.opacity(0.55))
                    }
                }
                .padding(.leading, 14)
                Spacer()
            }
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            Rectangle().fill(yellowColor).frame(height: 3)
        }
    }
}

// MARK: - Large Widget View

struct LargeView: View {
    let entry: BTCCEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(alignment: .center, spacing: 0) {
                VStack(spacing: 2) {
                    if let r = entry.round {
                        if r.isRaceWeekend {
                            Text("RACE").font(.system(size: 16, weight: .black)).foregroundColor(yellowColor)
                            Text("WKND").font(.system(size: 8, weight: .bold)).foregroundColor(.white.opacity(0.65))
                        } else {
                            let d = r.daysToGo
                            Text(d <= 0 ? "TODAY" : "\(d)").font(.system(size: 24, weight: .black)).foregroundColor(yellowColor)
                            Text(d <= 0 ? "" : (d == 1 ? "DAY" : "DAYS")).font(.system(size: 8, weight: .bold)).foregroundColor(.white.opacity(0.65))
                        }
                    } else {
                        Text("--").font(.system(size: 24, weight: .black)).foregroundColor(yellowColor)
                    }
                }
                .frame(width: 68)

                Rectangle().fill(Color.white.opacity(0.15)).frame(width: 1, height: 50)

                VStack(alignment: .leading, spacing: 3) {
                    if let r = entry.round {
                        Text("ROUNDS \(r.roundStart)–\(r.roundEnd) · NEXT RACE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white.opacity(0.55))
                        Text(r.venue).font(.system(size: 14, weight: .black)).foregroundColor(.white).lineLimit(1)
                        Text(r.dateRange).font(.system(size: 11)).foregroundColor(.white.opacity(0.7))
                    } else {
                        Text("BTCC Hub").font(.system(size: 14, weight: .black)).foregroundColor(.white)
                    }
                }
                .padding(.leading, 12)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)

            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1).padding(.horizontal, 14).padding(.vertical, 10)

            // Schedule + track map
            if let r = entry.round {
                let sat = r.sessions.filter { $0.day == "SAT" }
                let sun = r.sessions.filter { $0.day == "SUN" }
                let satW = entry.weather.first { Calendar.current.isDate($0.date, inSameDayAs: r.startDate) }
                let sunW = entry.weather.first { Calendar.current.isDate($0.date, inSameDayAs: r.endDate) }

                HStack(alignment: .top, spacing: 0) {
                    // Sessions
                    VStack(alignment: .leading, spacing: 0) {
                        if !sat.isEmpty {
                            ScheduleCol(header: "SATURDAY", sessions: sat, weather: satW?.summary)
                            if !sun.isEmpty { Spacer().frame(height: 10) }
                        }
                        if !sun.isEmpty {
                            ScheduleCol(header: "SUNDAY", sessions: sun, weather: sunW?.summary)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    // Track layout image + stats
                    if let img = entry.layoutImage {
                        Rectangle().fill(Color.white.opacity(0.1)).frame(width: 1).padding(.horizontal, 10)
                        VStack(spacing: 0) {
                            Image(uiImage: img)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 96)
                                .opacity(0.9)
                                .padding(.bottom, 8)

                            if let miles = r.lengthMiles {
                                TrackStat(label: "LENGTH", value: miles)
                                    .padding(.bottom, 4)
                            }
                            if let corners = r.corners {
                                TrackStat(label: "CORNERS", value: "\(corners)")
                                    .padding(.bottom, 4)
                            }

                            if let time = r.lapRecordTime, let driver = r.lapRecordDriver, let year = r.lapRecordYear {
                                Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1).padding(.vertical, 6)
                                TrackStat(label: "LAP RECORD", value: time)
                                    .padding(.bottom, 3)
                                Text("\(driver) '\(String(year).suffix(2))")
                                    .font(.system(size: 8))
                                    .foregroundColor(.white.opacity(0.5))
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .frame(width: 96)
                    }
                }
                .padding(.horizontal, 14)
            }

            Spacer(minLength: 0)
            Rectangle().fill(yellowColor).frame(height: 3)
        }
    }
}

struct ScheduleCol: View {
    let header: String
    let sessions: [SessionInfo]
    let weather: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(header).font(.system(size: 9, weight: .black)).foregroundColor(yellowColor)
                Spacer()
                if let w = weather { Text(w).font(.system(size: 9)).foregroundColor(.white.opacity(0.6)) }
            }
            .padding(.bottom, 8)
            ForEach(sessions.prefix(3)) { s in
                HStack {
                    Text(s.name).font(.system(size: 12, weight: .medium)).foregroundColor(.white).lineLimit(1)
                    Spacer()
                    Text(s.time).font(.system(size: 11)).foregroundColor(.white.opacity(0.6))
                }
                .padding(.vertical, 4)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct TrackStat: View {
    let label: String
    let value: String
    var body: some View {
        VStack(spacing: 1) {
            Text(value).font(.system(size: 11, weight: .black)).foregroundColor(.white)
            Text(label).font(.system(size: 8, weight: .bold)).foregroundColor(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Entry View

struct BTCCWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: BTCCEntry

    var body: some View {
        switch family {
        case .systemSmall:  SmallView(entry: entry)
        case .systemMedium: MediumView(entry: entry)
        case .systemLarge:  LargeView(entry: entry)
        default:            MediumView(entry: entry)
        }
    }
}

// MARK: - Widget

struct BTCCWidget: Widget {
    let kind = "BTCCWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BTCCProvider()) { entry in
            BTCCWidgetEntryView(entry: entry)
                .containerBackground(navyColor, for: .widget)
        }
        .configurationDisplayName("BTCC Hub")
        .description("Next race countdown and weekend schedule.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}


@main
struct BTCCWidgetBundle: WidgetBundle {
    var body: some Widget { BTCCWidget() }
}
