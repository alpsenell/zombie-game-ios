import Capacitor
import StoreKit

@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    private var products: [String: Product] = [:]
    private var updates: Task<Void, Never>?

    override public func load() {
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result else { continue }
                await transaction.finish()
                await self?.emitEntitlements()
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task { @MainActor in
            do {
                let list = try await Product.products(for: ids)
                var rows: [[String: Any]] = []
                for product in list {
                    self.products[product.id] = product
                    rows.append([
                        "id": product.id,
                        "title": product.displayName,
                        "description": product.description,
                        "price": product.displayPrice
                    ])
                }
                call.resolve(["products": rows])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("id is required")
            return
        }
        Task { @MainActor in
            do {
                var product = self.products[id]
                if product == nil { product = try await Product.products(for: [id]).first }
                guard let product = product else {
                    call.reject("Product not found")
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve(["status": "purchased", "id": transaction.productID])
                    case .unverified(_, let error):
                        call.reject("Purchase could not be verified: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.resolve(["status": "cancelled", "id": id])
                case .pending:
                    call.resolve(["status": "pending", "id": id])
                @unknown default:
                    call.resolve(["status": "unknown", "id": id])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func getEntitlements(_ call: CAPPluginCall) {
        Task { @MainActor in
            call.resolve(["owned": await self.ownedProductIDs()])
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            var syncError: Error?
            do {
                try await AppStore.sync()
            } catch {
                syncError = error
            }
            // Current entitlements are the source of truth in StoreKit 2; a failed sync
            // (offline, cancelled sign-in, StoreKit test environment) must not hide them.
            let owned = await self.ownedProductIDs()
            if let error = syncError, owned.isEmpty {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["owned": owned])
            }
        }
    }

    private func ownedProductIDs() async -> [String] {
        var ids: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.revocationDate == nil {
                ids.append(transaction.productID)
            }
        }
        return ids
    }

    private func emitEntitlements() async {
        let owned = await ownedProductIDs()
        await MainActor.run { self.notifyListeners("entitlementsChanged", data: ["owned": owned]) }
    }
}
