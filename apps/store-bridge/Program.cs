using System.Text.Json;
using Windows.Services.Store;

internal sealed record StoreRequest(string ServiceTicket, string PublisherUserId);

internal static class Program
{
    private static async Task<int> Main()
    {
        try
        {
            string input = await Console.In.ReadToEndAsync();
            StoreRequest? request = JsonSerializer.Deserialize<StoreRequest>(
                input,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (request is null ||
                string.IsNullOrWhiteSpace(request.ServiceTicket) ||
                string.IsNullOrWhiteSpace(request.PublisherUserId))
            {
                Console.Error.Write("Invalid Microsoft Store request.");
                return 2;
            }

            StoreContext context = StoreContext.GetDefault();
            string key = await context.GetCustomerCollectionsIdAsync(
                request.ServiceTicket,
                request.PublisherUserId);
            if (string.IsNullOrWhiteSpace(key))
            {
                Console.Error.Write("Microsoft Store did not return an identity key.");
                return 3;
            }

            Console.Out.Write(key);
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.Write(exception.Message);
            return 1;
        }
    }
}
