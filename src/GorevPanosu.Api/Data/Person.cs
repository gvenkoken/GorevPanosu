namespace GorevPanosu.Api.Data;

public sealed class Person
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FullName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
